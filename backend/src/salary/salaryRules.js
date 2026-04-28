// ─── Salary rules for Apex Concrete ───────────────────────────────────────
//
// Payable work types — all paid at $1.00 per SF/unit.
// Order matters: check most specific keywords first (EXTRA SIDEWALK before SIDEWALK).
//
const PAYABLE_KEYWORDS = [
  { keyword: 'POUR MONO SLAB',   label: 'Pour Mono Slab' },
  { keyword: 'MONO SLAB',        label: 'Pour Mono Slab' },
  { keyword: 'EXTRA SIDEWALK',   label: 'Extra Sidewalk' },
  { keyword: 'CITY SIDEWALK',    label: 'City Sidewalk' },
  { keyword: 'SIDEWALK',         label: 'Sidewalk' },
  { keyword: 'TURN DOWN',        label: 'Turn Down' },
  { keyword: 'TURNDOWN',         label: 'Turn Down' },
  { keyword: 'UNDERCUT',         label: 'Undercut' },
  { keyword: 'MUCK OUT',         label: 'Muck Out' },
  { keyword: 'MUCKOUT',          label: 'Muck Out' },
  { keyword: 'REPLACEMENT',      label: 'Replacement' },
  { keyword: 'PATCH',            label: 'Patch' },
  { keyword: 'DRIVES AND WALKS', label: 'Drives & Walks' },
  { keyword: 'DRIVES & WALKS',   label: 'Drives & Walks' },
  { keyword: 'DRIVEWAYS',        label: 'Driveways' },
  { keyword: 'DRIVEWAY',         label: 'Driveways' },
];

// EPO lines (productService matches \bEPO\b) are NOT auto-paid via SF×$1.
// They appear in the EPOs tab and pay is set manually via manualPay/manualQty.

// Lines containing these are shown on invoice but never paid to collaborator.
const NON_PAYABLE_KEYWORDS = ['MATERIAL'];

const COLLAB_RATE_PER_SF = 1.00;
const CLIENT_RATE_PER_SF = 2.00;

function isNonPayableText(text) {
  return NON_PAYABLE_KEYWORDS.some(k => text.includes(k));
}

function getLineWorkType(lineItem) {
  const text = [lineItem.productService, lineItem.description]
    .filter(Boolean).join(' ').toUpperCase();
  if (isNonPayableText(text)) return null;
  // EPO lines are paid only via manual override in the EPOs tab — not auto-paid by SF×$1.
  // Match on the productService field alone (the EPO marker), so a line whose
  // description happens to contain "EPO" but whose item is regular work still pays.
  if (/\bEPO\b/i.test(lineItem.productService || '')) return null;
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
  if (isNonPayableText(upperNote)) {
    return { hasMonoSlab: false, monoSlabQty: 0, collaboratorPay: 0 };
  }
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
    // Effective SF respects manual override (Emily's correction in UI)
    const qty = (inv.manualQty !== null && inv.manualQty !== undefined)
      ? inv.manualQty
      : (inv.monoSlabQty || 0);
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
      monoSlabQtyOriginal: inv.monoSlabQty || 0,
      manualQty: inv.manualQty ?? null,
      manualPay: inv.manualPay ?? null,
      pay,
      workTypes: workTypes.length ? workTypes.join(', ') : '—',
      formula: getPayFormula(inv.lineItems)
    });
  }

  return { total, totalQty, breakdown };
}
