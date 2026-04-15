import mongoose from 'mongoose';

const externalPaymentSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  amount:      { type: Number, required: true },
  isRecurring: { type: Boolean, default: false },
  // schedule — only if isRecurring
  schedule: {
    dayOfMonth: { type: Number, min: 1, max: 31 }, // 1-31
    hour:       { type: Number, min: 0, max: 23 },
    minute:     { type: Number, min: 0, max: 59, default: 0 },
  },
  active:    { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

export const ExternalPayment = mongoose.model('ExternalPayment', externalPaymentSchema);
