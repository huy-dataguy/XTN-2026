const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Sẽ được mã hóa (hash)
  name: { type: String, required: true },
  role: { type: String, enum: ['ADMIN', 'DISTRIBUTOR'], default: 'DISTRIBUTOR' },
  group: { type: String, enum: ['Tài Chính', 'Văn Phòng', 'Bàn Bếp', 'Sự Kiện', 'Truyền Thông', 'Hậu Cần'], required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', UserSchema);