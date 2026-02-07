const mongoose = require('mongoose');

const TagSchema = new mongoose.Schema({
  name: { type: String, required: true },
  color: { type: String, required: true }, // Lưu class màu (ví dụ: 'red', 'blue')
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Tag', TagSchema);