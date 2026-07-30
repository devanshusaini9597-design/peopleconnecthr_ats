const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

positionSchema.index({ createdBy: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Position', positionSchema);
