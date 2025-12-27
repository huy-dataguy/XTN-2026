const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Sẽ được mã hóa (hash)
  name: { type: String, required: true },
  role: { type: String, enum: ['ADMIN', 'DISTRIBUTOR'], default: 'DISTRIBUTOR' },
  group: { type: String, enum: ['GOLD', 'SILVER', 'NEW'], default: 'NEW' } // Chỉ dành cho Distributor
});

module.exports = mongoose.model('User', UserSchema);