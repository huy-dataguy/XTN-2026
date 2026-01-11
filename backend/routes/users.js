// server/routes/users.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
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

// 2. THÊM MỚI (Cần thêm)
router.post('/', auth, async (req, res) => {
  try {
    const { username, name, role, group } = req.body;
    // Kiểm tra admin
    if (req.user.role !== 'ADMIN') return res.status(403).json({ msg: 'No permission' });

    let user = await User.findOne({ username });
    if (user) return res.status(400).json({ msg: 'Username already exists' });

    user = new User({ username, name, role, group, password: '123' }); // MK mặc định là 123
    
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);

    await user.save();
    res.json(user);
  } catch (err) { res.status(500).send('Server Error'); }
});

// 3. XÓA (Cần thêm)
router.delete('/:id', auth, async (req, res) => {
  try {
    // Chỉ admin0 mới có quyền xóa (bảo mật tầng backend)
    const adminUser = await User.findById(req.user.id);
    if (adminUser.username !== 'admin0') return res.status(403).json({ msg: 'Only admin0 can delete' });

    await User.findByIdAndDelete(req.params.id);
    res.json({ msg: 'User deleted' });
  } catch (err) { res.status(500).send('Server Error'); }
});

// PUT /api/users/:id/reset-password
// Admin đổi mật khẩu cho user bất kỳ
router.put('/:id/reset-password', auth, async (req, res) => {
  try {
    // 1. Kiểm tra quyền Admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ msg: 'Access denied. Admins only.' });
    }

    const { newPassword } = req.body;
    
    // Validate cơ bản
    if (!newPassword || newPassword.length < 3) {
      return res.status(400).json({ msg: 'Mật khẩu phải có ít nhất 3 ký tự' });
    }

    // 2. Tìm User
    let user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    // 3. Mã hóa mật khẩu mới
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    // 4. Lưu lại
    await user.save();

    res.json({ msg: `Đổi mật khẩu thành công cho user: ${user.username}` });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});
// GET: Lấy danh sách chỉ các Admin (để giao task nội bộ)
router.get('/all-staff', auth, async (req, res) => {
  try {
    // 1. Check quyền: Người gọi api phải là Admin
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    // 2. Query: Chỉ lấy user có role là 'ADMIN'
    // .select(...) để chỉ lấy các trường cần thiết, bỏ qua password
    const admins = await User.find({ role: 'ADMIN' })
                             .select('name username role group');
    
    // 3. Format dữ liệu trả về
    const formatted = admins.map(u => ({
      id: u._id,
      name: u.name,
      username: u.username,
      role: u.role,
      label: `${u.name} (Admin)` 
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});



// 4. CẬP NHẬT THÔNG TIN (Sửa tên, nhóm, username)
router.put('/:id', auth, async (req, res) => {
  try {
    // Chỉ Admin mới có quyền sửa
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const { name, username, group } = req.body;
    
    // Tìm user theo ID
    let user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    // Nếu thay đổi username, cần kiểm tra xem username mới đã tồn tại chưa (trừ chính nó)
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ msg: 'Username already exists' });
      }
      user.username = username;
    }

    // Cập nhật các trường khác
    if (name) user.name = name;
    
    // Chỉ cập nhật group nếu user là DISTRIBUTOR (Admin thường không cần group hoặc logic khác)
    if (user.role === 'DISTRIBUTOR' && group) {
      user.group = group;
    }

    await user.save();

    // Trả về thông tin đã format để frontend cập nhật state
    res.json({
      id: user._id,
      username: user.username,
      name: user.name,
      role: user.role,
      group: user.group
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;