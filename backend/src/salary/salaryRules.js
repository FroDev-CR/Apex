// ─── Salary rules for Apex Concrete ───────────────────────────────────────
//
// POUR MONO SLAB:  collaborator pays $1.00 per m² (qty × $1)
// All other items: no collaborator payment
//
const MONO_SLAB_KEYWORD = 'MONO SLAB';
const COLLAB_RATE_PER_M2 = 1.00;
const CLIENT_RATE_PER_M2 = 2.00; // lo que cobra la empresa al cliente

/**
 * Check if a line item is a POUR MONO SLAB
 * Revisa productService Y description porque QBO a veces no manda ItemRef.Name
 */
export function isMonoSlab(lineItem) {
  const text = [lineItem.productService, lineItem.description]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();
  return text.includes(MONO_SLAB_KEYWORD);
}

/**
 * Extract POUR MONO SLAB lines from an invoice's line items
 */
export function getMonoSlabLines(lineItems = []) {
  return lineItems.filter(isMonoSlab);
}

/**
 * Total m² of POUR MONO SLAB in an invoice
 */
export function getMonoSlabQty(lineItems = []) {
  return getMonoSlabLines(lineItems).reduce((sum, l) => sum + (l.qty || 0), 0);
}

/**
 * Collaborator pay for an invoice ($1 × monoSlabQty)
 */
export function calculateCollaboratorPay(lineItems = []) {
  const qty = getMonoSlabQty(lineItems);
  return qty * COLLAB_RATE_PER_M2;
}

/**
 * Human-readable formula string for a given invoice
 */
export function getPayFormula(lineItems = []) {
  const qty = getMonoSlabQty(lineItems);
  if (qty === 0) return 'Sin POUR MONO SLAB — $0.00';
  const pay = qty * COLLAB_RATE_PER_M2;
  return `${qty.toLocaleString()} m² × $${COLLAB_RATE_PER_M2.toFixed(2)}/m² = $${pay.toFixed(2)}`;
}

/**
 * Compute summary fields from line items (cuando vienen de QBO API directo)
 * Returns: { hasMonoSlab, monoSlabQty, collaboratorPay }
 */
export function computeInvoicePayFields(lineItems = []) {
  const monoSlabQty = getMonoSlabQty(lineItems);
  return {
    hasMonoSlab: monoSlabQty > 0,
    monoSlabQty,
    collaboratorPay: monoSlabQty * COLLAB_RATE_PER_M2
  };
}

/**
 * Compute summary fields desde privateNote + totalAmount (cuando viene de Make)
 * Si privateNote contiene "mono slab", calcula qty desde totalAmount / $2
 */
export function computePayFieldsFromNote(privateNote = '', totalAmount = 0) {
  const isMono = privateNote.toUpperCase().includes(MONO_SLAB_KEYWORD);
  if (!isMono) return { hasMonoSlab: false, monoSlabQty: 0, collaboratorPay: 0 };

  // qty = totalAmount / $2 (rate que cobra la empresa)
  const monoSlabQty = CLIENT_RATE_PER_M2 > 0 ? totalAmount / CLIENT_RATE_PER_M2 : 0;
  return {
    hasMonoSlab: true,
    monoSlabQty,
    collaboratorPay: monoSlabQty * COLLAB_RATE_PER_M2
  };
}

/**
 * Calculate total salary for a collaborator across multiple invoices
 * @param {Array} invoices - Invoice documents
 * @returns {{ total, totalQty, breakdown[] }}
 */
export function calculatePeriodSalary(invoices = []) {
  let total = 0;
  let totalQty = 0;
  const breakdown = [];

  for (const inv of invoices) {
    const qty = inv.monoSlabQty || 0;
    const pay = inv.collaboratorPay || 0;
    total += pay;
    totalQty += qty;
    breakdown.push({
      invoiceId: inv._id,
      docNumber: inv.docNumber,
      customerName: inv.customerName,
      txnDate: inv.txnDate,
      monoSlabQty: qty,
      pay,
      formula: getPayFormula(inv.lineItems)
    });
  }

  return { total, totalQty, breakdown };
}
