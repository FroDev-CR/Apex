import { Router } from 'express';
import { getSettings, AppSettings } from '../models/AppSettings.js';

export const appSettingsRoutes = Router();

// GET /api/settings
appSettingsRoutes.get('/', async (req, res, next) => {
  try {
    const s = await getSettings();
    res.json(s);
  } catch (err) { next(err); }
});

// PATCH /api/settings
appSettingsRoutes.patch('/', async (req, res, next) => {
  try {
    const allowed = ['reportEmails', 'reportFrequency', 'reportHour', 'reportDayOfWeek', 'reportDayOfMonth'];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    const s = await AppSettings.findByIdAndUpdate(
      'singleton',
      { $set: update },
      { upsert: true, new: true, runValidators: true }
    );
    console.log('⚙️ Settings actualizados');
    res.json(s);
  } catch (err) { next(err); }
});
