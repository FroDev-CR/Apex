import mongoose from 'mongoose';

// Line item dentro de una invoice de QBO
const lineItemSchema = new mongoose.Schema({
  lineNum: { type: Number },
  productService: { type: String, default: '' }, // ItemRef.Name — ej: "POUR MONO SLAB", "EPO:REBAR"
  description: { type: String, default: '' },
  qty: { type: Number, default: 0 },
  rate: { type: Number, default: 0 },
  amount: { type: Number, default: 0 }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  // ── Identifiers ────────────────────────────────────────────────────────
  qboId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  docNumber: { type: String, default: '' }, // número visible en QBO (ej: "1858")

  // ── Dates ──────────────────────────────────────────────────────────────
  txnDate: { type: Date },
  dueDate: { type: Date },

  // ── Customer ───────────────────────────────────────────────────────────
  customerQboId: { type: String, default: '' },
  customerName: { type: String, default: '' }, // ej: "SHANNON WOODS LOT 34"
  billingCompany: { type: String, default: '' }, // ej: "LENNAR HOMES" (de BillAddr.Line1 o similar)

  // ── Line items ─────────────────────────────────────────────────────────
  lineItems: { type: [lineItemSchema], default: [] },

  // ── Totals ─────────────────────────────────────────────────────────────
  totalAmount: { type: Number, default: 0 }, // lo que se factura al cliente
  balance: { type: Number, default: 0 },     // lo que aún debe el cliente

  // ── Custom fields (hidden en QBO UI) ──────────────────────────────────
  builderNumber: { type: String, default: '' },
  estado: { type: String, default: '' },     // ej: "breakdown enviado"

  // ── Notes ──────────────────────────────────────────────────────────────
  privateNote: { type: String, default: '' }, // memo on statement (hidden) — aquí irá el colaborador

  // ── Collaborator ──────────────────────────────────────────────────────
  // Se extrae de privateNote / custom field cuando esté disponible
  collaborator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Collaborator',
    default: null
  },
  collaboratorRaw: { type: String, default: '' }, // texto crudo antes de hacer match

  // ── Computed / cached ──────────────────────────────────────────────────
  hasMonoSlab: { type: Boolean, default: false },
  monoSlabQty: { type: Number, default: 0 },
  collaboratorPay: { type: Number, default: 0 },
  // Manual SF override (EPO invoices — overrides monoSlabQty for salary calc)
  manualQty: { type: Number, default: null },

  // ── Sync ──────────────────────────────────────────────────────────────
  syncedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes para queries frecuentes
invoiceSchema.index({ txnDate: -1 });
invoiceSchema.index({ customerName: 1 });
invoiceSchema.index({ collaborator: 1 });
invoiceSchema.index({ hasMonoSlab: 1 });
invoiceSchema.index({ balance: 1 });

export const Invoice = mongoose.model('Invoice', invoiceSchema);
