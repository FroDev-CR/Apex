import { Router } from 'express';
import { ExternalPayment } from '../models/ExternalPayment.js';

export const paymentRoutes = Router();

// GET /api/payments — list all active
paymentRoutes.get('/', async (req, res, next) => {
  try {
    const payments = await ExternalPayment.find({ active: true }).sort({ createdAt: -1 });
    res.json(payments);
  } catch (err) { next(err); }
});

// POST /api/payments — create
paymentRoutes.post('/', async (req, res, next) => {
  try {
    const { name, amount, isRecurring, schedule } = req.body;
    if (!name || !amount) return res.status(400).json({ error: 'name y amount son requeridos' });

    const payment = await ExternalPayment.create({
      name,
      amount: Number(amount),
      isRecurring: !!isRecurring,
      schedule: isRecurring ? {
        dayOfMonth: Number(schedule?.dayOfMonth || 1),
        hour:       Number(schedule?.hour || 8),
        minute:     Number(schedule?.minute || 0),
      } : undefined,
    });
    console.log(`💰 Pago externo creado: ${name} — $${amount}`);
    res.status(201).json(payment);
  } catch (err) { next(err); }
});

// DELETE /api/payments/:id — soft delete
paymentRoutes.delete('/:id', async (req, res, next) => {
  try {
    await ExternalPayment.findByIdAndUpdate(req.params.id, { active: false });
    res.json({ success: true });
  } catch (err) { next(err); }
});
