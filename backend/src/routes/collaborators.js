import { Router } from 'express';
import { Collaborator } from '../models/Collaborator.js';

export const collaboratorRoutes = Router();

// GET /api/collaborators
collaboratorRoutes.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.active !== undefined) filter.isActive = req.query.active === 'true';
    const collaborators = await Collaborator.find(filter).sort({ name: 1 });
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
