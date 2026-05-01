// ─── Salary rules for Apex Concrete ───────────────────────────────────────
//
// Auto-payable work types and their per-unit rates paid to the collaborator.
// Order matters: check most specific keywords first (EXTRA SIDEWALK before SIDEWALK).
// Anything not in this list (Turn Down, Undercut, Muck Out, Replacement, Patch, EPO, …)
// pays $0 by default and must be set via manualPay/manualQty in the UI.
//
const PAYABLE_KEYWORDS = [
  { keyword: 'POUR MONO SLAB',   label: 'Pour Mono Slab', rate: 1.00 },
  { keyword: 'MONO SLAB',        label: 'Pour Mono Slab', rate: 1.00 },
  { keyword: 'EXTRA SIDEWALK',   label: 'Extra Sidewalk', rate: 0.75 },
  { keyword: 'CITY SIDEWALK',    label: 'City Sidewalk',  rate: 0.75 },
  { keyword: 'SIDEWALK',         label: 'Sidewalk',       rate: 0.75 },
  { keyword: 'DRIVES AND WALKS', label: 'Drives & Walks', rate: 0.75 },
  { keyword: 'DRIVES & WALKS',   label: 'Drives & Walks', rate: 0.75 },
  { keyword: 'DRIVEWAYS',        label: 'Driveways',      rate: 0.75 },
  { keyword: 'DRIVEWAY',         label: 'Driveways',      rate: 0.75 },
];

// Lines containing these are shown on invoice but never paid to collaborator.
const NON_PAYABLE_KEYWORDS = ['MATERIAL'];

// Used only by the legacy Make integration (computePayFieldsFromNote) to back-derive
// quantity from totalAmount. Real per-line rate now comes from PAYABLE_KEYWORDS.
const CLIENT_RATE_PER_SF = 2.00;

function isNonPayableText(text) {
  return NON_PAYABLE_KEYWORDS.some(k => text.includes(k));
}

// Returns the matching PAYABLE_KEYWORDS entry { keyword, label, rate } or null.
function getLineWorkType(lineItem) {
  const text = [lineItem.productService, lineItem.description]
    .filter(Boolean).join(' ').toUpperCase();
  if (isNonPayableText(text)) return null;
  // EPO lines are paid only via manual override in the EPOs tab — never auto-paid.
  // Match on the productService field alone so a line whose description happens to
  // contain "EPO" but whose item is regular work still pays.
  if (/\bEPO\b/i.test(lineItem.productService || '')) return null;
  for (const entry of PAYABLE_KEYWORDS) {
    if (text.includes(entry.keyword)) return entry;
  }
  return null;
}

/**
 * Check if a line item is auto-payable (mono slab, sidewalk, driveway, drives & walks).
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
  let pay = 0;
  for (const l of lineItems) {
    const wt = getLineWorkType(l);
    if (wt) pay += (l.qty || 0) * wt.rate;
  }
  return pay;
}

/**
 * Get unique work type labels present in an invoice's line items.
 * Falls back to the raw productService (with the leading "EPO:" prefix stripped)
 * for lines that don't match a known PAYABLE_KEYWORDS entry — so EPO and other
 * manual-pay items still display a meaningful task name in the salary report.
 */
export function getWorkTypes(lineItems = []) {
  const seen = new Set();
  const types = [];
  for (const li of lineItems) {
    const matched = getLineWorkType(li);
    let label = matched?.label;
    if (!label) {
      const raw = (li.productService || li.description || '').trim();
      if (!raw) continue;
      if (NON_PAYABLE_KEYWORDS.some(k => raw.toUpperCase().includes(k))) continue;
      label = raw.replace(/^EPO\s*[:\-]?\s*/i, '').trim() || raw;
    }
    if (!seen.has(label)) { seen.add(label); types.push(label); }
  }
  return types;
}

export function getPayFormula(lineItems = []) {
  const parts = [];
  let total = 0;
  for (const l of lineItems) {
    const wt = getLineWorkType(l);
    if (!wt) continue;
    const qty = l.qty || 0;
    const sub = qty * wt.rate;
    total += sub;
    parts.push(`${qty.toLocaleString()} × $${wt.rate.toFixed(2)} (${wt.label})`);
  }
  if (parts.length === 0) return 'Sin trabajo pagable — $0.00';
  return `${parts.join(' + ')} = $${total.toFixed(2)}`;
}

export function computeInvoicePayFields(lineItems = []) {
  const monoSlabQty = getMonoSlabQty(lineItems);
  const collaboratorPay = calculateCollaboratorPay(lineItems);
  return {
    hasMonoSlab: monoSlabQty > 0,
    monoSlabQty,
    collaboratorPay
  };
}

/**
 * Compute pay fields from privateNote + totalAmount (Make integration).
 * Uses the rate of the first matched keyword. Falls back to $0 if no keyword matches.
 */
export function computePayFieldsFromNote(privateNote = '', totalAmount = 0) {
  const upperNote = privateNote.toUpperCase();
  if (isNonPayableText(upperNote)) {
    return { hasMonoSlab: false, monoSlabQty: 0, collaboratorPay: 0 };
  }
  const match = PAYABLE_KEYWORDS.find(({ keyword }) => upperNote.includes(keyword));
  if (!match) return { hasMonoSlab: false, monoSlabQty: 0, collaboratorPay: 0 };
  const monoSlabQty = CLIENT_RATE_PER_SF > 0 ? totalAmount / CLIENT_RATE_PER_SF : 0;
  return { hasMonoSlab: true, monoSlabQty, collaboratorPay: monoSlabQty * match.rate };
}

/**
 * Calculate total salary for a collaborator across multiple invoices
 */
export function calculatePeriodSalary(invoices = []) {
  let total = 0;
  let totalQty = 0;
  const breakdown = [];

  for (const inv of invoices) {
    // Effective SF respects manual override (Emily's correction in UI)
    const qty = (inv.manualQty !== null && inv.manualQty !== undefined)
      ? inv.manualQty
      : (inv.monoSlabQty || 0);
    const pay = inv.collaboratorPay || 0;
    const workTypes = getWorkTypes(inv.lineItems || []);
    const isEpo = (inv.lineItems || []).some(l => /\bEPO\b/i.test(l.productService || ''));
    total += pay;
    totalQty += qty;
    breakdown.push({
      invoiceId: inv._id,
      docNumber: inv.docNumber,
      customerName: inv.customerName,
      txnDate: inv.txnDate,
      monoSlabQty: qty,
      monoSlabQtyOriginal: inv.monoSlabQty || 0,
      manualQty: inv.manualQty ?? null,
      manualPay: inv.manualPay ?? null,
      pay,
      isEpo,
      workTypes: workTypes.length ? workTypes.join(', ') : '—',
      formula: getPayFormula(inv.lineItems)
    });
  }

  return { total, totalQty, breakdown };
}
