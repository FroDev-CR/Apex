import { Router } from 'express';
import { ManualEntry } from '../models/ManualEntry.js';

export const manualEntryRoutes = Router();

// GET /api/manual-entries?dateFrom&dateTo&collaboratorId
manualEntryRoutes.get('/', async (req, res) => {
  try {
    const { dateFrom, dateTo, collaboratorId } = req.query;
    const filter = {};
    if (collaboratorId) filter.collaborator = collaboratorId;
    if (dateFrom || dateTo) {
      filter.txnDate = {};
      if (dateFrom) filter.txnDate.$gte = new Date(dateFrom);
      if (dateTo)   filter.txnDate.$lte = new Date(dateTo);
    }
    const entries = await ManualEntry.find(filter)
      .populate('collaborator', 'name color')
      .sort({ txnDate: -1 });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/manual-entries
manualEntryRoutes.post('/', async (req, res) => {
  try {
    const { collaborator, amount, reason, txnDate } = req.body;
    if (!collaborator) return res.status(400).json({ error: 'collaborator required' });
    if (amount === undefined || amount === null || amount === '') {
      return res.status(400).json({ error: 'amount required' });
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount)) return res.status(400).json({ error: 'amount must be a number' });

    const entry = await ManualEntry.create({
      collaborator,
      amount: numAmount,
      reason: reason || '',
      txnDate: txnDate ? new Date(txnDate) : new Date()
    });
    const populated = await ManualEntry.findById(entry._id).populate('collaborator', 'name color');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/manual-entries/:id
manualEntryRoutes.delete('/:id', async (req, res) => {
  try {
    const deleted = await ManualEntry.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
