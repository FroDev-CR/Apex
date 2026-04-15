import mongoose from 'mongoose';

const breakdownSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  formula: {
    type: String,
    required: true
  },
  calculatedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const salaryRecordSchema = new mongoose.Schema({
  collaboratorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Collaborator',
    required: true
  },
  period: {
    start: {
      type: Date,
      required: true
    },
    end: {
      type: Date,
      required: true
    }
  },
  ordersCompleted: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  breakdown: {
    type: [breakdownSchema],
    default: []
  }
}, {
  timestamps: true
});

// Index for efficient querying
salaryRecordSchema.index({ collaboratorId: 1, 'period.start': -1 });
salaryRecordSchema.index({ 'period.start': 1, 'period.end': 1 });

/**
 * SalaryRecord model for storing calculated salary records
 */
export const SalaryRecord = mongoose.model('SalaryRecord', salaryRecordSchema);
