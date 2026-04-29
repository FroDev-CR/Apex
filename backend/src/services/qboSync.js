import { qboRequest } from '../config/qbo.js';
import { Invoice } from '../models/Invoice.js';
import { Collaborator } from '../models/Collaborator.js';
import { computeInvoicePayFields } from '../salary/salaryRules.js';

function buildCollaboratorMap(collaborators) {
  // Sort by name length desc so multi-word collabs ("Juan Perez") beat single-word
  // collabs ("Juan") when both could match the same memo. Map preserves insertion order.
  const map = new Map();
  const sorted = [...collaborators].sort((a, b) => b.name.length - a.name.length);
  for (const c of sorted) {
    map.set(c.name.toLowerCase().trim(), c._id);
  }
  return map;
}

// Match only when the collab name appears as a whole word in the memo. Using
// non-letter lookarounds (Unicode-aware) so "ED" does NOT match inside "REPLACED",
// and accented names like "JOSÉ" still match cleanly. Returns the longest match
// because the map is pre-sorted by name length desc.
function matchCollaborator(raw = '', collabMap) {
  if (!raw) return null;
  const text = String(raw).trim();
  if (!text) return null;
  for (const [name, id] of collabMap.entries()) {
    if (!name) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^\\p{L}])${escaped}($|[^\\p{L}])`, 'iu');
    if (re.test(text)) return id;
  }
  return null;
}

async function mapQBOInvoice(qbo, collabMap) {
  const lineItems = (qbo.Line || [])
    .filter(l => l.DetailType === 'SalesItemLineDetail')
    .map(l => ({
      lineNum: l.LineNum,
      productService: l.SalesItemLineDetail?.ItemRef?.name || l.SalesItemLineDetail?.ItemRef?.Name || l.Description || '',
      description: l.Description || '',
      qty: l.SalesItemLineDetail?.Qty || 0,
      rate: l.SalesItemLineDetail?.UnitPrice || 0,
      amount: l.Amount || 0
    }));

  // Invoice.PrivateNote = "Memo on statement (hidden)" in QBO UI — primary collaborator source.
  // Match-only against existing collaborators (no auto-create) since legacy memos still
  // contain work names like "CITYWALK"/"flatwork" until Emily migrates them.
  const privateNote = qbo.PrivateNote || '';
  const customFields = qbo.CustomField || [];
  const collaboratorId = matchCollaborator(privateNote, collabMap);
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
    collaboratorRaw: privateNote,
    ...payFields,
    syncedAt: new Date()
  };
  // Only overwrite collaborator when we actually resolved one — never overwrite with null.
  // Preserves manual UI assignments on invoices whose PrivateNote doesn't match a known collab.
  if (collaboratorId !== null) base.collaborator = collaboratorId;
  return base;
}

export async function syncQBOInvoices({ sinceDays } = {}) {
  const fast = typeof sinceDays === 'number' && sinceDays > 0;
  console.log(`🔄 [qboSync] Starting QBO invoice sync${fast ? ` (last ${sinceDays} days)` : ' (full)'}...`);

  const collaborators = await Collaborator.find({ isActive: true });
  const collabMap = buildCollaboratorMap(collaborators);

  // Build TxnDate filter for fast sync
  let dateClause = '';
  if (fast) {
    const since = new Date(Date.now() - sinceDays * 86400000);
    const sinceStr = since.toISOString().slice(0, 10);
    dateClause = ` WHERE TxnDate >= '${sinceStr}'`;
  }

  let startPosition = 1;
  const pageSize = 100;
  let totalFetched = 0;
  let inserted = 0;
  let updated = 0;

  while (true) {
    const query = `SELECT * FROM Invoice${dateClause} ORDERBY TxnDate DESC STARTPOSITION ${startPosition} MAXRESULTS ${pageSize}`;
    const data = await qboRequest('/query', { query });
    const invoices = data.QueryResponse?.Invoice || [];

    if (invoices.length === 0) break;

    for (const qboInv of invoices) {
      const mapped = await mapQBOInvoice(qboInv, collabMap);
      const existing = await Invoice.findOne(
        { qboId: mapped.qboId },
        { manualQty: 1, manualPay: 1 }
      );
      // Preserve manual override: $ wins over SF override wins over computed.
      if (existing) {
        if (existing.manualPay !== null && existing.manualPay !== undefined) {
          mapped.collaboratorPay = existing.manualPay;
        } else if (existing.manualQty !== null && existing.manualQty !== undefined) {
          mapped.collaboratorPay = existing.manualQty * 1.00;
        }
      }
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
