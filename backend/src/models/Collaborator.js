import mongoose from 'mongoose';

const collaboratorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: false,
    unique: true,
    sparse: true,   // permite múltiples documentos con email null/undefined
    lowercase: true,
    trim: true
  },
  color: {
    type: String,
    default: '#3B82F6'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

collaboratorSchema.index({ isActive: 1 });

export const Collaborator = mongoose.model('Collaborator', collaboratorSchema);
