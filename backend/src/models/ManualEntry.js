import mongoose from 'mongoose';

// Manual salary entry — not a real QBO invoice. Created by Emily in Salary tab
// for off-invoice payments (advances, bonuses, corrections, cash work).
// Persists in DB and shows in salary report + exports alongside invoice-based pay.
const manualEntrySchema = new mongoose.Schema({
  collaborator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Collaborator',
    required: true,
    index: true
  },
  amount: { type: Number, required: true },
  reason: { type: String, default: '' },
  txnDate: { type: Date, default: Date.now }
}, { timestamps: true });

manualEntrySchema.index({ txnDate: -1 });

export const ManualEntry = mongoose.model('ManualEntry', manualEntrySchema);
