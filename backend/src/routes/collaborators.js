import { Router } from 'express';
import { Collaborator } from '../models/Collaborator.js';
import { Invoice } from '../models/Invoice.js';
import { ManualEntry } from '../models/ManualEntry.js';

export const collaboratorRoutes = Router();

// GET /api/collaborators?withCounts=true
collaboratorRoutes.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.active !== undefined) filter.isActive = req.query.active === 'true';
    const collaborators = await Collaborator.find(filter).sort({ name: 1 }).lean();

    if (req.query.withCounts === 'true' && collaborators.length) {
      const ids = collaborators.map(c => c._id);
      const [invAgg, manAgg] = await Promise.all([
        Invoice.aggregate([
          { $match: { collaborator: { $in: ids } } },
          { $group: { _id: '$collaborator', n: { $sum: 1 } } }
        ]),
        ManualEntry.aggregate([
          { $match: { collaborator: { $in: ids } } },
          { $group: { _id: '$collaborator', n: { $sum: 1 } } }
        ])
      ]);
      const invMap = new Map(invAgg.map(x => [String(x._id), x.n]));
      const manMap = new Map(manAgg.map(x => [String(x._id), x.n]));
      for (const c of collaborators) {
        c.invoiceCount = invMap.get(String(c._id)) || 0;
        c.manualEntryCount = manMap.get(String(c._id)) || 0;
      }
    }
    res.json(collaborators);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/collaborators/:id
collaboratorRoutes.get('/:id', async (req, res) => {
  try {
    const collaborator = await Collaborator.findById(req.params.id);
    if (!collaborator) return res.status(404).json({ error: 'Collaborator not found' });
    res.json(collaborator);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/collaborators
collaboratorRoutes.post('/', async (req, res) => {
  try {
    const { name, email, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    if (email) {
      const existing = await Collaborator.findOne({ email: email.toLowerCase() });
      if (existing) return res.status(409).json({ error: 'Email already in use' });
    }

    const collaborator = await Collaborator.create({ name, email: email || undefined, color });
    res.status(201).json(collaborator);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/collaborators/:id
collaboratorRoutes.put('/:id', async (req, res) => {
  try {
    const { name, email, color, isActive } = req.body;

    if (email) {
      const existing = await Collaborator.findOne({ email: email.toLowerCase(), _id: { $ne: req.params.id } });
      if (existing) return res.status(409).json({ error: 'Email already in use' });
    }

    const update = {};
    if (name !== undefined) update.name = name;
    if (email !== undefined) update.email = email;
    if (color !== undefined) update.color = color;
    if (isActive !== undefined) update.isActive = isActive;

    const collaborator = await Collaborator.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    if (!collaborator) return res.status(404).json({ error: 'Collaborator not found' });
    res.json(collaborator);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/collaborators/cleanup-orphans  (hard-delete collabs with 0 references)
// Safe nuke for the junk created by the old Customer.Notes auto-create path:
// only removes collabs that have ZERO invoices AND ZERO manual entries assigned.
collaboratorRoutes.post('/cleanup-orphans', async (req, res) => {
  try {
    const all = await Collaborator.find({}, { _id: 1, name: 1 });
    const usedInInvoices = await Invoice.distinct('collaborator', { collaborator: { $ne: null } });
    const usedInManual = await ManualEntry.distinct('collaborator', { collaborator: { $ne: null } });
    const usedSet = new Set([...usedInInvoices, ...usedInManual].map(String));
    const toDelete = all.filter(c => !usedSet.has(String(c._id)));
    const ids = toDelete.map(c => c._id);
    if (ids.length === 0) return res.json({ deleted: 0, names: [] });
    await Collaborator.deleteMany({ _id: { $in: ids } });
    res.json({ deleted: ids.length, names: toDelete.map(c => c.name) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/collaborators/bulk-delete  (hard delete by IDs — refuses if any have refs)
collaboratorRoutes.post('/bulk-delete', async (req, res) => {
  try {
    const { ids, force } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array required' });
    }
    if (!force) {
      const usedInv = await Invoice.distinct('collaborator', { collaborator: { $in: ids } });
      const usedMan = await ManualEntry.distinct('collaborator', { collaborator: { $in: ids } });
      const blocked = [...new Set([...usedInv, ...usedMan].map(String))];
      if (blocked.length > 0) {
        const blockedDocs = await Collaborator.find({ _id: { $in: blocked } }, { name: 1 });
        return res.status(409).json({
          error: 'Some collaborators have invoices or manual entries — pass {force:true} to delete anyway',
          blocked: blockedDocs.map(c => ({ id: c._id, name: c.name }))
        });
      }
    }
    const result = await Collaborator.deleteMany({ _id: { $in: ids } });
    res.json({ deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/collaborators/bulk-deactivate  (bulk soft delete)
collaboratorRoutes.post('/bulk-deactivate', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array required' });
    }
    const result = await Collaborator.updateMany(
      { _id: { $in: ids } },
      { $set: { isActive: false } }
    );
    res.json({ deactivated: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/collaborators/:id  (soft delete)
collaboratorRoutes.delete('/:id', async (req, res) => {
  try {
    const collaborator = await Collaborator.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: false } },
      { new: true }
    );
    if (!collaborator) return res.status(404).json({ error: 'Collaborator not found' });
    res.json({ message: 'Collaborator deactivated', collaborator });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
