import { qboRequest } from '../config/qbo.js';
import { Invoice } from '../models/Invoice.js';
import { Collaborator } from '../models/Collaborator.js';
import { computeInvoicePayFields } from '../salary/salaryRules.js';

function buildCollaboratorMap(collaborators) {
  const map = new Map();
  for (const c of collaborators) {
    map.set(c.name.toLowerCase().trim(), c._id);
  }
  return map;
}

function matchCollaborator(raw = '', collabMap) {
  if (!raw) return null;
  const normalized = raw.toLowerCase().trim();
  for (const [name, id] of collabMap.entries()) {
    if (normalized.includes(name)) return id;
  }
  return null;
}

function mapQBOInvoice(qbo, collabMap) {
  const lineItems = (qbo.Line || [])
    .filter(l => l.DetailType === 'SalesItemLineDetail')
    .map(l => ({
      lineNum: l.LineNum,
      productService: l.SalesItemLineDetail?.ItemRef?.Name || l.Description || '',
      description: l.Description || '',
      qty: l.SalesItemLineDetail?.Qty || 0,
      rate: l.SalesItemLineDetail?.UnitPrice || 0,
      amount: l.Amount || 0
    }));

  const privateNote = qbo.PrivateNote || '';
  const customFields = qbo.CustomField || [];
  // Log custom field names to help debug field name mismatches
  if (customFields.length > 0) {
    const fieldNames = customFields.map(f => `"${f.Name}"="${f.StringValue}"`).join(', ');
    console.log(`[qboSync] Invoice #${qbo.DocNumber} CustomFields: ${fieldNames}`);
  }
  const employeeField = customFields.find(f => f.Name?.toLowerCase().includes('employee'))?.StringValue || '';
  const collaboratorRawText = employeeField || privateNote;
  const collaboratorId = matchCollaborator(collaboratorRawText, collabMap);
  const builderNumber = customFields.find(f => f.Name?.toLowerCase().includes('builder'))?.StringValue || '';
  const estado = customFields.find(f => f.Name?.toLowerCase() === 'estado')?.StringValue || '';

  const billAddr = qbo.BillAddr || {};
  const billingCompany = billAddr.Line1 || '';

  const payFields = computeInvoicePayFields(lineItems);

  return {
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
    collaboratorRaw: collaboratorRawText,
    ...payFields,
    syncedAt: new Date()
  };
}

export async function syncQBOInvoices() {
  console.log('🔄 [qboSync] Starting QBO invoice sync...');

  const collaborators = await Collaborator.find({ isActive: true });
  const collabMap = buildCollaboratorMap(collaborators);

  let startPosition = 1;
  const pageSize = 100;
  let totalFetched = 0;
  let inserted = 0;
  let updated = 0;

  while (true) {
    const query = `SELECT * FROM Invoice ORDERBY TxnDate DESC STARTPOSITION ${startPosition} MAXRESULTS ${pageSize}`;
    const data = await qboRequest('/query', { query });
    const invoices = data.QueryResponse?.Invoice || [];

    if (invoices.length === 0) break;

    for (const qboInv of invoices) {
      const mapped = mapQBOInvoice(qboInv, collabMap);
      const existing = await Invoice.exists({ qboId: mapped.qboId });
      await Invoice.findOneAndUpdate(
        { qboId: mapped.qboId },
        { $set: mapped },
        { upsert: true, runValidators: true }
      );
      if (existing) updated++; else inserted++;
    }

    totalFetched += invoices.length;
    console.log(`  📄 [qboSync] Synced ${totalFetched} invoices...`);

    if (invoices.length < pageSize) break;
    startPosition += pageSize;
  }

  console.log(`✅ [qboSync] Done — ${inserted} new, ${updated} updated`);
  return { total: totalFetched, inserted, updated };
}
