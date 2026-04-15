import mongoose from 'mongoose';

// Singleton — always one document with _id = 'singleton'
const appSettingsSchema = new mongoose.Schema({
  _id:             { type: String, default: 'singleton' },
  reportEmails:    { type: [String], default: [] },
  reportFrequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'daily' },
  reportHour:      { type: Number, default: 8, min: 0, max: 23 },
  reportDayOfWeek: { type: Number, default: 1, min: 0, max: 6 },  // 1 = Monday
  reportDayOfMonth:{ type: Number, default: 1, min: 1, max: 31 },
}, { _id: false, timestamps: true });

export const AppSettings = mongoose.model('AppSettings', appSettingsSchema);

export async function getSettings() {
  let s = await AppSettings.findById('singleton');
  if (!s) s = await AppSettings.create({ _id: 'singleton' });
  return s;
}
