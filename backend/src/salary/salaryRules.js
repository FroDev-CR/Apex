// ─── Salary rules for Apex Concrete ───────────────────────────────────────
//
// Payable work types — all paid at $1.00 per SF/unit:
//   POUR MONO SLAB | DRIVES AND WALKS | CITY SIDEWALK | EPO
//
const PAYABLE_KEYWORDS = [
  { keyword: 'MONO SLAB',       label: 'Pour Mono Slab' },
  { keyword: 'DRIVES AND WALKS', label: 'Drives & Walks' },
  { keyword: 'DRIVES & WALKS',  label: 'Drives & Walks' },
  { keyword: 'CITY SIDEWALK',   label: 'City Sidewalk' },
  { keyword: 'EPO',             label: 'EPO' },
];

const COLLAB_RATE_PER_SF = 1.00;
const CLIENT_RATE_PER_SF = 2.00;

function getLineWorkType(lineItem) {
  const text = [lineItem.productService, lineItem.description]
    .filter(Boolean).join(' ').toUpperCase();
  for (const { keyword, label } of PAYABLE_KEYWORDS) {
    if (text.includes(keyword)) return label;
  }
  return null;
}

/**
 * Check if a line item is payable work (Mono Slab, Drives & Walks, City Sidewalk, EPO)
 * Named isMonoSlab for backwards compatibility with DB field names.
 */
export function isMonoSlab(lineItem) {
  return getLineWorkType(lineItem) !== null;
}

export function getMonoSlabLines(lineItems = []) {
  return lineItems.filter(isMonoSlab);
}

export function getMonoSlabQty(lineItems = []) {
  return getMonoSlabLines(lineItems).reduce((sum, l) => sum + (l.qty || 0), 0);
}

export function calculateCollaboratorPay(lineItems = []) {
  return getMonoSlabQty(lineItems) * COLLAB_RATE_PER_SF;
}

/**
 * Get unique work type labels present in an invoice's line items
 */
export function getWorkTypes(lineItems = []) {
  const seen = new Set();
  const types = [];
  for (const li of lineItems) {
    const t = getLineWorkType(li);
    if (t && !seen.has(t)) { seen.add(t); types.push(t); }
  }
  return types;
}

export function getPayFormula(lineItems = []) {
  const qty = getMonoSlabQty(lineItems);
  if (qty === 0) return 'Sin trabajo pagable — $0.00';
  const pay = qty * COLLAB_RATE_PER_SF;
  const types = getWorkTypes(lineItems);
  const typeStr = types.length ? types.join(', ') : 'Trabajo';
  return `${qty.toLocaleString()} SF × $${COLLAB_RATE_PER_SF.toFixed(2)}/SF = $${pay.toFixed(2)} (${typeStr})`;
}

export function computeInvoicePayFields(lineItems = []) {
  const monoSlabQty = getMonoSlabQty(lineItems);
  return {
    hasMonoSlab: monoSlabQty > 0,
    monoSlabQty,
    collaboratorPay: monoSlabQty * COLLAB_RATE_PER_SF
  };
}

/**
 * Compute pay fields from privateNote + totalAmount (Make integration)
 */
export function computePayFieldsFromNote(privateNote = '', totalAmount = 0) {
  const upperNote = privateNote.toUpperCase();
  const isPayable = PAYABLE_KEYWORDS.some(({ keyword }) => upperNote.includes(keyword));
  if (!isPayable) return { hasMonoSlab: false, monoSlabQty: 0, collaboratorPay: 0 };
  const monoSlabQty = CLIENT_RATE_PER_SF > 0 ? totalAmount / CLIENT_RATE_PER_SF : 0;
  return { hasMonoSlab: true, monoSlabQty, collaboratorPay: monoSlabQty * COLLAB_RATE_PER_SF };
}

/**
 * Calculate total salary for a collaborator across multiple invoices
 */
export function calculatePeriodSalary(invoices = []) {
  let total = 0;
  let totalQty = 0;
  const breakdown = [];

  for (const inv of invoices) {
    const qty = inv.monoSlabQty || 0;
    const pay = inv.collaboratorPay || 0;
    const workTypes = getWorkTypes(inv.lineItems || []);
    total += pay;
    totalQty += qty;
    breakdown.push({
      invoiceId: inv._id,
      docNumber: inv.docNumber,
      customerName: inv.customerName,
      txnDate: inv.txnDate,
      monoSlabQty: qty,
      pay,
      workTypes: workTypes.length ? workTypes.join(', ') : '—',
      formula: getPayFormula(inv.lineItems)
    });
  }

  return { total, totalQty, breakdown };
}
