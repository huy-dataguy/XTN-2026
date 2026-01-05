const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // Middleware xác thực
const Statement = require('../models/Statement');

// GET: Lấy danh sách sao kê
router.get('/', auth, async (req, res) => {
  try {
    // Chỉ Admin mới được xem
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    // Sắp xếp: Ngày giao dịch mới nhất lên đầu, sau đó đến ngày tạo
    const statements = await Statement.find().sort({ transactionDate: -1, createdAt: -1 });
    res.json(statements);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// POST: Thêm dòng sao kê mới (Nhập thủ công)
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const { transactionDate, type, amount, partnerName, description, balance } = req.body;

    const newStatement = new Statement({
      transactionDate,
      type,
      amount,
      partnerName,
      description,
      balance
    });

    const savedStatement = await newStatement.save();
    res.json(savedStatement);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// DELETE: Xóa dòng sao kê (Nếu nhập sai)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    await Statement.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Statement removed' });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

module.exports = router;