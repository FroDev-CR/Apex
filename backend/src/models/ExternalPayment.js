import mongoose from 'mongoose';

const externalPaymentSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  amount:      { type: Number, required: true },
  isRecurring: { type: Boolean, default: false },
  schedule: {
    frequency:   { type: String, enum: ['daily', 'weekly', 'monthly'] },
    dayOfWeek:   { type: Number, min: 0, max: 6 },  // weekly: 0=Sun 1=Mon
    dayOfMonth:  { type: Number, min: 1, max: 31 },  // monthly: inferred from createdAt
    hour:        { type: Number, min: 0, max: 23, default: 8 },
  },
  startDate: { type: Date, default: Date.now },
  active:    { type: Boolean, default: true },
}, { timestamps: true });

export const ExternalPayment = mongoose.model('ExternalPayment', externalPaymentSchema);
