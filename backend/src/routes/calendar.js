import { Router } from 'express';
import { Order, Collaborator } from '../models/index.js';

export const calendarRoutes = Router();

/**
 * Parse ISO week string (YYYY-WW) to start and end dates
 * @param {string} weekString - Week in format YYYY-WW
 * @returns {{ start: Date, end: Date }}
 */
function parseWeek(weekString) {
  const [year, week] = weekString.split('-W').map(Number);

  // Get January 4th of the year (always in week 1 per ISO standard)
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // Convert Sunday (0) to 7

  // Calculate the Monday of week 1
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - dayOfWeek + 1);

  // Calculate the Monday of the requested week
  const start = new Date(week1Monday);
  start.setDate(week1Monday.getDate() + (week - 1) * 7);
  start.setHours(0, 0, 0, 0);

  // Calculate the Sunday of the requested week
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Get current ISO week string
 * @returns {string} - Week in format YYYY-WW
 */
function getCurrentWeek() {
  const now = new Date();
  const year = now.getFullYear();

  // Calculate week number
  const jan1 = new Date(year, 0, 1);
  const dayOfYear = Math.ceil((now - jan1 + 1) / 86400000);
  const dayOfWeek = jan1.getDay() || 7;
  const weekNum = Math.ceil((dayOfYear + dayOfWeek - 1) / 7);

  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * GET /api/calendar
 * Get orders grouped by collaborator for a given week
 * Query params: week (format: YYYY-WW)
 */
calendarRoutes.get('/', async (req, res) => {
  try {
    const { week = getCurrentWeek() } = req.query;

    // Validate week format
    if (!/^\d{4}-W\d{2}$/.test(week)) {
      return res.status(400).json({
        error: 'Invalid week format',
        message: 'Week must be in format YYYY-WW (e.g., 2024-W01)'
      });
    }

    const { start, end } = parseWeek(week);

    // Get all active collaborators
    const collaborators = await Collaborator.find({ isActive: true })
      .sort({ name: 1 })
      .lean();

    // Get all orders for the week
    const orders = await Order.find({
      $or: [
        // Orders assigned to this week
        {
          assignedDate: { $gte: start, $lte: end }
        },
        // Unassigned orders (show in sidebar)
        {
          taskStatus: 'unassigned'
        }
      ]
    })
      .populate('assignedTo', 'name email color')
      .sort({ date: -1 })
      .lean();

    // Group orders by collaborator and day
    const assignedOrders = orders.filter(o => o.assignedTo);
    const unassignedOrders = orders.filter(o => !o.assignedTo);

    // Create calendar data structure
    const calendarData = {
      week,
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      collaborators: collaborators.map(collab => {
        const collabOrders = assignedOrders.filter(
          o => o.assignedTo?._id.toString() === collab._id.toString()
        );

        // Group by day of week (0-6, where 0 is Sunday)
        const ordersByDay = {};
        for (let i = 0; i < 7; i++) {
          ordersByDay[i] = [];
        }

        collabOrders.forEach(order => {
          if (order.assignedDate) {
            const dayOfWeek = new Date(order.assignedDate).getDay();
            ordersByDay[dayOfWeek].push(order);
          }
        });

        return {
          _id: collab._id,
          name: collab.name,
          email: collab.email,
          color: collab.color,
          availability: collab.availability,
          totalOrders: collabOrders.length,
          ordersByDay
        };
      }),
      unassigned: unassignedOrders
    };

    res.json(calendarData);
  } catch (error) {
    console.error('❌ Error fetching calendar data:', error.message);
    res.status(500).json({ error: 'Failed to fetch calendar data' });
  }
});

/**
 * GET /api/calendar/day
 * Get orders for a specific day
 * Query params: date (format: YYYY-MM-DD)
 */
calendarRoutes.get('/day', async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all active collaborators
    const collaborators = await Collaborator.find({ isActive: true })
      .sort({ name: 1 })
      .lean();

    // Get orders for the day
    const orders = await Order.find({
      assignedDate: { $gte: startOfDay, $lte: endOfDay }
    })
      .populate('assignedTo', 'name email color')
      .sort({ date: -1 })
      .lean();

    // Get unassigned orders
    const unassignedOrders = await Order.find({
      taskStatus: 'unassigned'
    })
      .sort({ date: -1 })
      .lean();

    // Group by collaborator
    const calendarData = {
      date,
      period: {
        start: startOfDay.toISOString(),
        end: endOfDay.toISOString()
      },
      collaborators: collaborators.map(collab => {
        const collabOrders = orders.filter(
          o => o.assignedTo?._id.toString() === collab._id.toString()
        );

        return {
          _id: collab._id,
          name: collab.name,
          email: collab.email,
          color: collab.color,
          orders: collabOrders
        };
      }),
      unassigned: unassignedOrders
    };

    res.json(calendarData);
  } catch (error) {
    console.error('❌ Error fetching day data:', error.message);
    res.status(500).json({ error: 'Failed to fetch day data' });
  }
});
