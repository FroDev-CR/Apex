import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  sku: {
    type: String,
    default: ''
  },
  qty: {
    type: Number,
    default: 1
  },
  price: {
    type: Number,
    default: 0
  },
  // UOM = SF (square feet) para órdenes normales, EA para EPOs
  uom: {
    type: String,
    default: ''
  }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  customer: {
    type: String,
    default: ''
  },
  // Campos específicos de Hyphen Supply Pro
  task: {
    type: String,
    default: ''
  },
  orderType: {
    type: String,
    default: ''
  },
  jobAddress: {
    type: String,
    default: ''
  },
  planElevation: {
    type: String,
    default: ''
  },
  subdivision: {
    type: String,
    default: ''
  },
  lotBlock: {
    type: String,
    default: ''
  },
  permitNumber: {
    type: String,
    default: ''
  },
  supplierOrderNum: {
    type: String,
    default: ''
  },
  products: {
    type: [productSchema],
    default: []
  },
  // Puede ser negativo (ej: Back Charge EPO)
  total: {
    type: Number,
    default: 0
  },
  date: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    default: 'Received'
  },
  rawUrl: {
    type: String,
    default: ''
  },
  scrapedAt: {
    type: Date,
    default: Date.now
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Collaborator',
    default: null
  },
  assignedDate: {
    type: Date,
    default: null
  },
  taskStatus: {
    type: String,
    enum: ['unassigned', 'assigned', 'in_progress', 'done'],
    default: 'unassigned'
  }
}, {
  timestamps: true
});

// Index for efficient querying
orderSchema.index({ date: -1 });
orderSchema.index({ taskStatus: 1 });
orderSchema.index({ assignedTo: 1, assignedDate: 1 });

/**
 * Order model for storing Supply Pro orders
 */
export const Order = mongoose.model('Order', orderSchema);
