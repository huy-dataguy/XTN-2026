// server/routes/users.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// GET /api/users/distributors - Lấy danh sách tất cả người phân phối
router.get('/distributors', auth, async (req, res) => {
  try {
    // Chỉ Admin mới được xem danh sách nhân viên
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const distributors = await User.find({ role: 'DISTRIBUTOR' }).select('-password'); // Bỏ qua password
    
    // Map _id sang id
    const formatted = distributors.map(u => ({
      id: u._id,
      username: u.username,
      name: u.name,
      role: u.role,
      group: u.group
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;