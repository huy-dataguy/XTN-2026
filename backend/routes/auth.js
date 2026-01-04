const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
// POST /api/auth/register
router.post('/register', async (req, res) => {
  // 1. Nhận thêm 'securityCode' từ frontend
  const { username, password, name, role, group, securityCode } = req.body;

  try {
    // --- BẮT ĐẦU: KIỂM TRA BẢO MẬT ---
    const adminCode = process.env.ADMIN_REGISTRATION_CODE;
    const distributorCode = process.env.DISTRIBUTOR_REGISTRATION_CODE;

    // Logic kiểm tra mã dựa trên Role mà user muốn đăng ký
    if (role === 'ADMIN') {
        if (securityCode !== adminCode) {
            return res.status(403).json({ msg: 'Sai mã bảo mật dành cho Admin (Admin Security Code).' });
        }
    } else if (role === 'DISTRIBUTOR') {
        if (securityCode !== distributorCode) {
            return res.status(403).json({ msg: 'Sai mã giới thiệu (Invite Code).' });
        }
    } else {
        // Nếu cố tình gửi role bậy bạ
        return res.status(400).json({ msg: 'Role không hợp lệ.' });
    }
    // --- KẾT THÚC: KIỂM TRA BẢO MẬT ---

    // 2. Kiểm tra user tồn tại
    let user = await User.findOne({ username });
    if (user) return res.status(400).json({ msg: 'Username đã tồn tại.' });

    // 3. Tạo user mới
    user = new User({ 
      username, 
      password, 
      name, 
      role, 
      group // Nếu là ADMIN thì frontend gửi undefined, Mongoose tự bỏ qua
    });
    
    // 4. Mã hóa mật khẩu
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();
    res.json({ msg: 'User registered successfully' });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ msg: 'Invalid Credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials' });

    // Tạo Token
    const payload = { user: { id: user.id, role: user.role } };
    
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' }, (err, token) => {
      if (err) throw err;
      // Trả về đủ thông tin bao gồm group để Frontend hiển thị
      res.json({ 
        token, 
        user: { 
          id: user.id, 
          username: user.username, 
          name: user.name, 
          role: user.role, 
          group: user.group 
        } 
      });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});


// --- THÊM VÀO ROUTER (sau phần login/register) ---

// POST /api/auth/impersonate/:id
// Yêu cầu: Header phải có x-auth-token của Admin
router.post('/impersonate/:id', require('../middleware/auth'), async (req, res) => {
  try {
    // 1. Kiểm tra người gọi API có phải là ADMIN không?
    // req.user được lấy từ middleware auth
    const adminRequesting = await User.findById(req.user.id);
    if (!adminRequesting || adminRequesting.role !== 'ADMIN') {
      return res.status(403).json({ msg: 'Access denied. Admins only.' });
    }

    // 2. Tìm user mục tiêu muốn đăng nhập vào
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // 3. Tạo Token mới với danh tính của user mục tiêu
    const payload = {
      user: {
        id: targetUser.id,
        role: targetUser.role
      }
    };

    // Ký token (Lưu ý: process.env.JWT_SECRET phải trùng với lúc login)
    jwt.sign(
      payload,
      process.env.JWT_SECRET, 
      { expiresIn: '1d' },
      (err, token) => {
        if (err) throw err;
        
        // 4. Trả về Token và thông tin User y hệt như API Login
        res.json({
          token,
          user: {
            id: targetUser.id,
            username: targetUser.username,
            name: targetUser.name,
            role: targetUser.role,
            group: targetUser.group
          }
        });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;