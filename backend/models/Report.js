const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  distributorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  weekStartDate: { type: Date, required: true },
  totalRevenue: Number,
  totalSold: Number,
  totalDamaged: Number,
  details: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: String,
    quantityReceived: Number,
    quantitySold: Number,
    quantityDamaged: Number,
    revenue: Number,
    remainingStock: Number
  }],
  notes: String,
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' }
});

module.exports = mongoose.model('Report', ReportSchema);