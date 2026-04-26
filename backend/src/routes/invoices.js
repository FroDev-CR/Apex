import { Router } from 'express';
import { Invoice } from '../models/Invoice.js';

export const invoiceRoutes = Router();

// ─── GET /api/invoices ─────────────────────────────────────────────────────
// Filters: customer, collaborator, hasMonoSlab, estado, dateFrom, dateTo, unpaidOnly
// Pagination: page, limit (default 50)
invoiceRoutes.get('/', async (req, res) => {
  try {
    const {
      customer, collaborator, hasMonoSlab, estado,
      dateFrom, dateTo, unpaidOnly,
      page = 1, limit = 50
    } = req.query;

    const filter = {};
    if (customer) filter.customerName = { $regex: customer, $options: 'i' };
    if (collaborator) filter.collaborator = collaborator;
    if (hasMonoSlab !== undefined) filter.hasMonoSlab = hasMonoSlab === 'true';
    if (estado) filter.estado = { $regex: estado, $options: 'i' };
    if (unpaidOnly === 'true') filter.balance = { $gt: 0 };
    if (dateFrom || dateTo) {
      filter.txnDate = {};
      if (dateFrom) filter.txnDate.$gte = new Date(dateFrom);
      if (dateTo) filter.txnDate.$lte = new Date(dateTo);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .populate('collaborator', 'name color')
        .sort({ txnDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Invoice.countDocuments(filter)
    ]);

    res.json({
      invoices,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/invoices/:id ─────────────────────────────────────────────────
invoiceRoutes.get('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('collaborator', 'name color email');
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/invoices/import ────────────────────────────────────────────
// Called by Make — accepts an array of QBO-format invoices, upserts to MongoDB
invoiceRoutes.post('/import', async (req, res) => {
  try {
    const invoices = Array.isArray(req.body) ? req.body : [req.body];
    if (!invoices.length) return res.status(400).json({ error: 'No invoices provided' });

    const { Collaborator } = await import('../models/Collaborator.js');
    const { computeInvoicePayFields, computePayFieldsFromNote } = await import('../salary/salaryRules.js');

    const collaborators = await Collaborator.find({ isActive: true });
    const collabMap = new Map(collaborators.map(c => [c.name.toLowerCase().trim(), c._id]));

    let inserted = 0, updated = 0;

    for (const raw of invoices) {
      // Normalize: soporta tanto QBO API format (PascalCase) como Make format (camelCase)
      const qbo = normalizeInvoice(raw);

      const lineItems = (qbo.Line || [])
        .filter(l => l.DetailType === 'SalesItemLineDetail')
        .map(l => ({
          lineNum: l.LineNum,
          productService: l.SalesItemLineDetail?.ItemRef?.Name || '',
          description: l.Description || '',
          qty: l.SalesItemLineDetail?.Qty || 0,
          rate: l.SalesItemLineDetail?.UnitPrice || 0,
          amount: l.Amount || 0
        }));

      const privateNote = qbo.PrivateNote || '';
      let collaboratorId = null;
      const normalized = privateNote.toLowerCase().trim();
      for (const [name, id] of collabMap.entries()) {
        if (normalized.includes(name)) { collaboratorId = id; break; }
      }

      const customFields = qbo.CustomField || [];
      const builderNumber = customFields.find(f =>
        (f.Name || f.name || '').toLowerCase().includes('builder'))?.StringValue || '';
      const estado = customFields.find(f =>
        (f.Name || f.name || '').toLowerCase() === 'estado')?.StringValue || '';
      const billingCompany = qbo.BillAddr?.Line1 || '';

      // M2 custom field — campo directo desde Make o desde CustomField[]
      const m2Raw = raw.m2 || raw.M2 ||
        customFields.find(f => (f.Name || f.name || '').toUpperCase() === 'M2')?.StringValue || 0;
      const m2 = parseFloat(m2Raw) || 0;

      // Prioridad: 1) campo M2 directo, 2) line items, 3) privateNote + totalAmount
      let payFields;
      if (m2 > 0) {
        const isMono = privateNote.toUpperCase().includes('MONO SLAB');
        payFields = {
          hasMonoSlab: isMono,
          monoSlabQty: isMono ? m2 : 0,
          collaboratorPay: isMono ? m2 * 1.00 : 0
        };
      } else if (lineItems.length > 0) {
        payFields = computeInvoicePayFields(lineItems);
      } else {
        payFields = computePayFieldsFromNote(privateNote, qbo.TotalAmt || 0);
      }

      const doc = {
        qboId: qbo.Id,
        docNumber: qbo.DocNumber || '',
        txnDate: qbo.TxnDate ? new Date(qbo.TxnDate) : null,
        dueDate: qbo.DueDate ? new Date(qbo.DueDate) : null,
        customerQboId: qbo.CustomerRef?.value || '',
        customerName: qbo.CustomerRef?.name || '',
        billingCompany,
        lineItems,
        totalAmount: qbo.TotalAmt || 0,
        balance: qbo.Balance || 0,
        builderNumber,
        estado,
        privateNote,
        collaborator: collaboratorId,
        collaboratorRaw: privateNote,
        ...payFields,
        syncedAt: new Date()
      };

      const existing = await Invoice.findOne({ qboId: doc.qboId });
      await Invoice.findOneAndUpdate({ qboId: doc.qboId }, { $set: doc }, { upsert: true });
      existing ? updated++ : inserted++;
    }

    console.log(`✅ Make import: ${inserted} nuevas, ${updated} actualizadas`);
    res.json({ success: true, inserted, updated, total: invoices.length });
  } catch (err) {
    console.error('❌ Make import error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Normalize invoice from Make or QBO API format ────────────────────────
// Make usa camelCase/snake, QBO API usa PascalCase — normalizamos a PascalCase
function normalizeInvoice(inv) {
  if (inv.Id) return inv; // ya es formato QBO API

  // Formato Make → QBO
  const lines = (inv.line || inv.Line || []).map(l => {
    // Make puede mandar lines ya mapeadas o en formato QBO
    if (l.DetailType) return l;
    return {
      LineNum: l.lineNum || l.line_num,
      DetailType: 'SalesItemLineDetail',
      Description: l.description || '',
      Amount: l.amount || 0,
      SalesItemLineDetail: {
        ItemRef: { Name: l.productService || l.product_service || l.name || '' },
        Qty: l.qty || l.quantity || 0,
        UnitPrice: l.rate || l.unitPrice || l.unit_price || 0
      }
    };
  });

  const customFields = (inv.customField || inv.custom_field || inv.CustomField || []).map(f => ({
    Name: f.name || f.Name || '',
    StringValue: f.stringValue || f.string_value || f.StringValue || f.value || ''
  }));

  return {
    Id: inv.id || inv.invoiceId || inv.invoice_id || '',
    DocNumber: inv.docNumber || inv.doc_number || inv.DocNumber || '',
    TxnDate: inv.txnDate || inv.transaction_date || inv.TxnDate || '',
    DueDate: inv.dueDate || inv.due_date || inv.DueDate || '',
    TotalAmt: inv.totalAmount || inv.total_amount || inv.TotalAmt || 0,
    Balance: inv.balance || inv.Balance || 0,
    PrivateNote: inv.privateNote || inv.private_note || inv.PrivateNote || '',
    CustomerRef: {
      value: inv.customer?.value || inv.customerRef?.value || '',
      name: inv.customer?.name || inv.customerRef?.name || ''
    },
    BillAddr: { Line1: inv.billAddress?.line1 || inv.bill_address?.line1 || '' },
    CustomField: customFields,
    Line: lines
  };
}

// ─── POST /api/invoices/recalculate ───────────────────────────────────────
// Recalcula hasMonoSlab, monoSlabQty y collaboratorPay para todas las facturas
// usando los lineItems ya guardados en MongoDB. Útil para arreglar facturas antiguas.
invoiceRoutes.post('/recalculate', async (req, res) => {
  try {
    const { computeInvoicePayFields } = await import('../salary/salaryRules.js');
    const invoices = await Invoice.find({});
    let fixed = 0;

    for (const inv of invoices) {
      const payFields = computeInvoicePayFields(inv.lineItems || []);
      const changed =
        inv.hasMonoSlab !== payFields.hasMonoSlab ||
        inv.monoSlabQty !== payFields.monoSlabQty ||
        inv.collaboratorPay !== payFields.collaboratorPay;

      if (changed) {
        await Invoice.updateOne({ _id: inv._id }, { $set: payFields });
        fixed++;
      }
    }

    console.log(`✅ Recalculate: ${fixed} facturas corregidas de ${invoices.length} total`);
    res.json({ success: true, total: invoices.length, fixed });
  } catch (err) {
    console.error('❌ Recalculate error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Shared helper — $ priority: manualPay > manualQty × $1 > monoSlabQty × $1
function recalcEffectivePay(invoice) {
  if (invoice.manualPay !== null && invoice.manualPay !== undefined) {
    return invoice.manualPay;
  }
  const qty = (invoice.manualQty !== null && invoice.manualQty !== undefined)
    ? invoice.manualQty
    : (invoice.monoSlabQty || 0);
  return qty; // $1/SF
}

// ─── PATCH /api/invoices/:id/manual-qty ───────────────────────────────────
invoiceRoutes.patch('/:id/manual-qty', async (req, res) => {
  try {
    const qty = req.body.qty === null ? null : Number(req.body.qty);
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    invoice.manualQty = qty;
    invoice.collaboratorPay = recalcEffectivePay(invoice);
    await invoice.save();

    res.json({ success: true, manualQty: invoice.manualQty, collaboratorPay: invoice.collaboratorPay });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/invoices/:id/manual-pay ───────────────────────────────────
invoiceRoutes.patch('/:id/manual-pay', async (req, res) => {
  try {
    const pay = req.body.pay === null ? null : Number(req.body.pay);
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    invoice.manualPay = pay;
    invoice.collaboratorPay = recalcEffectivePay(invoice);
    await invoice.save();

    res.json({ success: true, manualPay: invoice.manualPay, collaboratorPay: invoice.collaboratorPay });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/invoices/:id/collaborator ──────────────────────────────────
// Manually assign/override a collaborator on an invoice
invoiceRoutes.patch('/:id/collaborator', async (req, res) => {
  try {
    const { collaboratorId } = req.body;
    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { collaborator: collaboratorId || null },
      { new: true }
    ).populate('collaborator', 'name color');
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/invoices/bulk-assign ────────────────────────────────────────
// Bulk-assign a collaborator to many invoices at once
invoiceRoutes.post('/bulk-assign', async (req, res) => {
  try {
    const { invoiceIds, collaboratorId } = req.body;
    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return res.status(400).json({ error: 'invoiceIds array required' });
    }
    const result = await Invoice.updateMany(
      { _id: { $in: invoiceIds } },
      { $set: { collaborator: collaboratorId || null } }
    );
    res.json({ updated: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
