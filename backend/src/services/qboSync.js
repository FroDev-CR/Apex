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

const COLLAB_COLORS = [
  '#f97316','#3b82f6','#10b981','#8b5cf6','#ef4444',
  '#f59e0b','#06b6d4','#ec4899','#84cc16','#6366f1',
];

function matchCollaborator(raw = '', collabMap) {
  if (!raw) return null;
  const normalized = raw.toLowerCase().trim();
  for (const [name, id] of collabMap.entries()) {
    if (normalized.includes(name) || name.includes(normalized)) return id;
  }
  return null;
}

// Only called when Employee custom field is explicitly set — trusted person name
async function matchOrCreateFromEmployee(employeeName = '', collabMap) {
  if (!employeeName) return null;
  const existing = matchCollaborator(employeeName, collabMap);
  if (existing) return existing;

  const name = employeeName.trim();
  const color = COLLAB_COLORS[collabMap.size % COLLAB_COLORS.length];
  const created = await Collaborator.findOneAndUpdate(
    { name },
    { $set: { isActive: true }, $setOnInsert: { name, color } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  collabMap.set(name.toLowerCase(), created._id);
  console.log(`[qboSync] Auto-created collaborator: "${name}"`);
  return created._id;
}

async function mapQBOInvoice(qbo, collabMap) {
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
  if (customFields.length > 0) {
    const fieldNames = customFields.map(f => `"${f.Name}"="${f.StringValue}"`).join(', ');
    console.log(`[qboSync] Invoice #${qbo.DocNumber} CustomFields: ${fieldNames}`);
  }
  const employeeField = customFields.find(f => f.Name?.toLowerCase().includes('employ'))?.StringValue?.trim() || '';
  const collaboratorRawText = employeeField || privateNote;
  // Employee field → auto-create if not found. privateNote → match only, never auto-create.
  const collaboratorId = employeeField
    ? await matchOrCreateFromEmployee(employeeField, collabMap)
    : matchCollaborator(privateNote, collabMap);
  const builderNumber = customFields.find(f => f.Name?.toLowerCase().includes('builder'))?.StringValue || '';
  const estado = customFields.find(f => f.Name?.toLowerCase() === 'estado')?.StringValue || '';

  const billingCompany = qbo.BillAddr?.Line1 || '';
  const payFields = computeInvoicePayFields(lineItems);

  const base = {
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
    collaboratorRaw: collaboratorRawText,
    ...payFields,
    syncedAt: new Date()
  };
  // Only overwrite collaborator when we actually resolved one — never overwrite with null.
  // This preserves manual assignments on invoices that have no Employee field in QBO.
  if (collaboratorId !== null) base.collaborator = collaboratorId;
  return base;
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
      const mapped = await mapQBOInvoice(qboInv, collabMap);
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
