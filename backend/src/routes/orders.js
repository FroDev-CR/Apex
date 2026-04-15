import { Router } from 'express';
import { Order } from '../models/index.js';

export const orderRoutes = Router();

/**
 * GET /api/orders
 * List all orders with optional filters
 * Query params: status, date, assignedTo, taskStatus, page, limit
 */
orderRoutes.get('/', async (req, res) => {
  try {
    const {
      status,
      date,
      assignedTo,
      taskStatus,
      page = 1,
      limit = 50
    } = req.query;

    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      filter.date = { $gte: startOfDay, $lte: endOfDay };
    }

    if (assignedTo) {
      filter.assignedTo = assignedTo === 'null' ? null : assignedTo;
    }

    if (taskStatus) {
      filter.taskStatus = taskStatus;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('assignedTo', 'name email color')
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Order.countDocuments(filter)
    ]);

    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Error fetching orders:', error.message);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

/**
 * GET /api/orders/:id
 * Get a single order by ID
 */
orderRoutes.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('assignedTo', 'name email color role hourlyRate')
      .lean();

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('❌ Error fetching order:', error.message);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

/**
 * PATCH /api/orders/:id/assign
 * Assign an order to a collaborator with a date
 * Body: { collaboratorId, assignedDate }
 */
orderRoutes.patch('/:id/assign', async (req, res) => {
  try {
    const { collaboratorId, assignedDate } = req.body;

    const updateData = {
      assignedTo: collaboratorId || null,
      assignedDate: assignedDate ? new Date(assignedDate) : null,
      taskStatus: collaboratorId ? 'assigned' : 'unassigned'
    };

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    ).populate('assignedTo', 'name email color');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    console.log(`✅ Order #${order.orderId} assigned to ${order.assignedTo?.name || 'unassigned'}`);

    res.json(order);
  } catch (error) {
    console.error('❌ Error assigning order:', error.message);
    res.status(500).json({ error: 'Failed to assign order' });
  }
});

/**
 * PATCH /api/orders/:id/status
 * Update the task status of an order
 * Body: { taskStatus }
 */
orderRoutes.patch('/:id/status', async (req, res) => {
  try {
    const { taskStatus } = req.body;

    if (!['unassigned', 'assigned', 'in_progress', 'done'].includes(taskStatus)) {
      return res.status(400).json({ error: 'Invalid task status' });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: { taskStatus } },
      { new: true }
    ).populate('assignedTo', 'name email color');

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    console.log(`✅ Order #${order.orderId} status changed to ${taskStatus}`);

    res.json(order);
  } catch (error) {
    console.error('❌ Error updating order status:', error.message);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});
