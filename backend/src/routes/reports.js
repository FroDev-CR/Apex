import { Router } from 'express';
import { Invoice } from '../models/Invoice.js';
import { Collaborator } from '../models/Collaborator.js';
import { calculatePeriodSalary, getWorkTypes } from '../salary/salaryRules.js';

export const reportRoutes = Router();

// ─── Helpers ───────────────────────────────────────────────────────────────
function dateFilter(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return {};
  const f = {};
  if (dateFrom) f.$gte = new Date(dateFrom);
  if (dateTo) f.$lte = new Date(dateTo);
  return { txnDate: f };
}

// ─── GET /api/reports/salary ───────────────────────────────────────────────
// Salary report: how much to pay each collaborator
// Query: dateFrom, dateTo, collaboratorId (optional)
reportRoutes.get('/salary', async (req, res) => {
  try {
    const { dateFrom, dateTo, collaboratorId } = req.query;

    const invoiceFilter = {
      hasMonoSlab: true,
      collaboratorPay: { $gt: 1 },
      ...dateFilter(dateFrom, dateTo)
    };
    if (collaboratorId) invoiceFilter.collaborator = collaboratorId;

    const invoices = await Invoice.find(invoiceFilter)
      .populate('collaborator', 'name color email')
      .sort({ txnDate: -1 });

    // Group by collaborator (null = sin asignar)
    const byCollab = new Map();
    for (const inv of invoices) {
      const key = inv.collaborator ? inv.collaborator._id.toString() : '__unassigned__';
      if (!byCollab.has(key)) {
        byCollab.set(key, {
          collaborator: inv.collaborator || null,
          invoices: []
        });
      }
      byCollab.get(key).invoices.push(inv);
    }

    const results = [];
    for (const { collaborator, invoices: collabInvoices } of byCollab.values()) {
      const { total, totalQty, breakdown } = calculatePeriodSalary(collabInvoices);
      results.push({
        collaborator,
        totalPay: total,
        totalM2: totalQty,
        invoiceCount: collabInvoices.length,
        breakdown
      });
    }

    // Asignados primero por totalPay, sin asignar al final
    results.sort((a, b) => {
      if (!a.collaborator && b.collaborator) return 1;
      if (a.collaborator && !b.collaborator) return -1;
      return b.totalPay - a.totalPay;
    });

    const grandTotal = results.reduce((s, r) => s + r.totalPay, 0);
    res.json({ results, grandTotal, period: { dateFrom, dateTo } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/reports/receivables ─────────────────────────────────────────
// Accounts receivable: unpaid invoices grouped by customer
// Query: dateFrom, dateTo
reportRoutes.get('/receivables', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;

    const invoices = await Invoice.find({
      balance: { $gt: 0 },
      ...dateFilter(dateFrom, dateTo)
    })
      .populate('collaborator', 'name color')
      .sort({ dueDate: 1 });

    // Group by customer
    const byCustomer = new Map();
    for (const inv of invoices) {
      const key = inv.customerName || 'Unknown';
      if (!byCustomer.has(key)) {
        byCustomer.set(key, { customerName: key, invoices: [], totalBalance: 0 });
      }
      const group = byCustomer.get(key);
      group.invoices.push(inv);
      group.totalBalance += inv.balance;
    }

    const customers = Array.from(byCustomer.values())
      .sort((a, b) => b.totalBalance - a.totalBalance);

    const totalReceivable = customers.reduce((s, c) => s + c.totalBalance, 0);
    res.json({ customers, totalReceivable, period: { dateFrom, dateTo } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/reports/revenue ──────────────────────────────────────────────
// Revenue summary: total invoiced, paid, pending
// Query: dateFrom, dateTo
reportRoutes.get('/revenue', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const filter = dateFilter(dateFrom, dateTo);

    const invoices = await Invoice.find(filter).sort({ txnDate: -1 });

    const totalInvoiced = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const totalPaid = invoices.reduce((s, i) => s + (i.totalAmount - i.balance), 0);
    const totalPending = invoices.reduce((s, i) => s + i.balance, 0);

    // Group by month
    const byMonth = new Map();
    for (const inv of invoices) {
      if (!inv.txnDate) continue;
      const key = inv.txnDate.toISOString().slice(0, 7); // YYYY-MM
      if (!byMonth.has(key)) {
        byMonth.set(key, { month: key, invoiced: 0, paid: 0, pending: 0, count: 0 });
      }
      const m = byMonth.get(key);
      m.invoiced += inv.totalAmount;
      m.paid += inv.totalAmount - inv.balance;
      m.pending += inv.balance;
      m.count++;
    }

    const monthly = Array.from(byMonth.values()).sort((a, b) => b.month.localeCompare(a.month));

    res.json({
      totalInvoiced,
      totalPaid,
      totalPending,
      invoiceCount: invoices.length,
      monthly,
      period: { dateFrom, dateTo }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/reports/margin ───────────────────────────────────────────────
// Margin report: revenue vs collaborator costs
// Query: dateFrom, dateTo
reportRoutes.get('/margin', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const filter = dateFilter(dateFrom, dateTo);

    const invoices = await Invoice.find(filter);

    const totalRevenue = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const totalCollabCost = invoices.reduce((s, i) => s + (i.collaboratorPay || 0), 0);
    const totalM2 = invoices.reduce((s, i) => s + (i.monoSlabQty || 0), 0);
    const grossMargin = totalRevenue - totalCollabCost;
    const marginPct = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;

    // Per-customer margin
    const byCustomer = new Map();
    for (const inv of invoices) {
      const key = inv.customerName || 'Unknown';
      if (!byCustomer.has(key)) {
        byCustomer.set(key, { customerName: key, revenue: 0, collabCost: 0, m2: 0, count: 0 });
      }
      const g = byCustomer.get(key);
      g.revenue += inv.totalAmount;
      g.collabCost += inv.collaboratorPay || 0;
      g.m2 += inv.monoSlabQty || 0;
      g.count++;
    }

    const customers = Array.from(byCustomer.values()).map(c => ({
      ...c,
      margin: c.revenue - c.collabCost,
      marginPct: c.revenue > 0 ? ((c.revenue - c.collabCost) / c.revenue) * 100 : 0
    })).sort((a, b) => b.revenue - a.revenue);

    res.json({
      totalRevenue,
      totalCollabCost,
      totalM2,
      grossMargin,
      marginPct,
      customers,
      period: { dateFrom, dateTo }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/reports/export ───────────────────────────────────────────────
// Todos los datos del período para generar Excel/CSV en el frontend
reportRoutes.get('/export', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const filter = dateFilter(dateFrom, dateTo);

    const invoices = await Invoice.find(filter)
      .populate('collaborator', 'name color')
      .sort({ txnDate: -1 });

    // ── Resumen general ──
    const totalRevenue    = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const totalReceivable = invoices.reduce((s, i) => s + i.balance, 0);
    const totalCollabCost = invoices.reduce((s, i) => s + (i.collaboratorPay || 0), 0);
    const totalM2         = invoices.reduce((s, i) => s + (i.monoSlabQty || 0), 0);
    const grossMargin     = totalRevenue - totalCollabCost;

    // ── Facturas detalladas ──
    // Phantoms (collaboratorPay <= 1) se muestran como facturas normales pero sin SF/pago
    const invoiceRows = invoices.map(inv => {
      const isPhantom = inv.hasMonoSlab && (inv.collaboratorPay || 0) <= 1;
      return {
        fecha:          inv.txnDate ? new Date(inv.txnDate).toLocaleDateString('es-CR') : '',
        factura:        inv.docNumber,
        cliente:        inv.customerName,
        empresa:        inv.billingCompany || inv.customerName,
        estado:         inv.estado || '',
        totalFacturado: inv.totalAmount,
        saldoPendiente: inv.balance,
        pagado:         inv.totalAmount - inv.balance,
        esMonoSlab:     (inv.hasMonoSlab && !isPhantom) ? 'Sí' : 'No',
        m2:             isPhantom ? 0 : ((inv.manualQty !== null && inv.manualQty !== undefined) ? inv.manualQty : (inv.monoSlabQty || 0)),
        pagoCollab:     isPhantom ? 0 : (inv.collaboratorPay || 0),
        colaborador:    inv.collaborator?.name || 'Sin asignar',
        tarea:          isPhantom ? '' : (getWorkTypes(inv.lineItems || []).join(', ') || ''),
      };
    });

    // ── Salarios por colaborador ──
    const bySalary = new Map();
    for (const inv of invoices) {
      if (!inv.hasMonoSlab || (inv.collaboratorPay || 0) <= 1) continue;
      const key  = inv.collaborator?._id?.toString() || '__unassigned__';
      const name = inv.collaborator?.name || 'Sin asignar';
      if (!bySalary.has(key)) bySalary.set(key, { colaborador: name, m2: 0, total: 0, facturas: 0, breakdown: [] });
      const g = bySalary.get(key);
      const workTypes = getWorkTypes(inv.lineItems || []);
      const effectiveSF = (inv.manualQty !== null && inv.manualQty !== undefined)
        ? inv.manualQty
        : (inv.monoSlabQty || 0);
      g.m2       += effectiveSF;
      g.total    += inv.collaboratorPay || 0;
      g.facturas += 1;
      g.breakdown.push({
        docNumber:    inv.docNumber,
        customerName: inv.customerName,
        fecha:        inv.txnDate ? new Date(inv.txnDate).toLocaleDateString('es-CR') : '',
        m2:           effectiveSF,
        pay:          inv.collaboratorPay || 0,
        tarea:        workTypes.join(', ') || '—',
      });
    }
    const salaryRows = Array.from(bySalary.values())
      .sort((a, b) => b.total - a.total);

    res.json({
      period: { dateFrom, dateTo },
      resumen: { totalRevenue, totalReceivable, totalCollabCost, totalM2, grossMargin,
                 invoiceCount: invoices.length, marginPct: totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0 },
      invoices: invoiceRows,
      salaries: salaryRows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/reports/epos ────────────────────────────────────────────────
// EPO invoices grouped by collaborator — editable SF for salary override
reportRoutes.get('/epos', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const filter = {
      'lineItems': {
        $elemMatch: {
          $or: [
            { productService: { $regex: 'EPO', $options: 'i' } },
            { description: { $regex: 'EPO', $options: 'i' } }
          ]
        }
      },
      ...dateFilter(dateFrom, dateTo)
    };

    const invoices = await Invoice.find(filter)
      .populate('collaborator', 'name color')
      .sort({ txnDate: -1 });

    const byCollab = new Map();
    for (const inv of invoices) {
      const key  = inv.collaborator ? inv.collaborator._id.toString() : '__unassigned__';
      if (!byCollab.has(key)) {
        byCollab.set(key, { collaborator: inv.collaborator || null, invoices: [] });
      }
      byCollab.get(key).invoices.push({
        _id:            inv._id,
        docNumber:      inv.docNumber,
        customerName:   inv.customerName,
        txnDate:        inv.txnDate,
        totalAmount:    inv.totalAmount,
        monoSlabQty:    inv.monoSlabQty,
        manualQty:      inv.manualQty,
        manualPay:      inv.manualPay,
        collaboratorPay: inv.collaboratorPay,
      });
    }

    const results = Array.from(byCollab.values()).map(g => ({
      collaborator: g.collaborator,
      invoices: g.invoices,
      totalPay: g.invoices.reduce((s, i) => s + i.collaboratorPay, 0),
    })).sort((a, b) => {
      if (!a.collaborator && b.collaborator) return 1;
      if (a.collaborator && !b.collaborator) return -1;
      return b.totalPay - a.totalPay;
    });

    res.json({ results, period: { dateFrom, dateTo } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/reports/overview ─────────────────────────────────────────────
// Dashboard overview: key numbers at a glance
reportRoutes.get('/overview', async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const filter = dateFilter(dateFrom, dateTo);

    const [invoices, collabCount] = await Promise.all([
      Invoice.find(filter),
      Collaborator.countDocuments({ isActive: true })
    ]);

    const totalRevenue = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const totalCollabCost = invoices.reduce((s, i) => s + (i.collaboratorPay || 0), 0);
    const totalReceivable = invoices.reduce((s, i) => s + i.balance, 0);
    const totalM2 = invoices.reduce((s, i) => s + (i.monoSlabQty || 0), 0);

    res.json({
      invoiceCount: invoices.length,
      totalRevenue,
      totalCollabCost,
      grossMargin: totalRevenue - totalCollabCost,
      marginPct: totalRevenue > 0 ? ((totalRevenue - totalCollabCost) / totalRevenue) * 100 : 0,
      totalReceivable,
      totalM2,
      collabCount,
      period: { dateFrom, dateTo }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
