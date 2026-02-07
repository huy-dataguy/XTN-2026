const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Statement = require('../models/Statement');

// GET: Lấy danh sách sao kê (Kèm thông tin Tag)
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ msg: 'Access denied' });
    }
    // .populate('tags') là lệnh quan trọng để lấy object Tag thay vì chỉ ID
    const statements = await Statement.find()
      .populate('tags') 
      .sort({ transactionDate: -1, createdAt: -1 });
    res.json(statements);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// POST: Thêm dòng sao kê mới
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    // Lấy thêm mảng tags từ body
    const { transactionDate, type, amount, partnerName, description, balance, tags } = req.body;

    const newStatement = new Statement({
      transactionDate,
      type,
      amount,
      partnerName,
      description,
      balance,
      tags: tags || [] // Lưu mảng ID tags
    });

    const savedStatement = await newStatement.save();
    // Populate ngay sau khi save để trả về frontend hiển thị luôn
    await savedStatement.populate('tags');
    
    res.json(savedStatement);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// DELETE: Xóa dòng sao kê
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
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ msg: 'Access denied' });
    }

    const { transactionDate, type, amount, partnerName, description, balance, tags } = req.body;

    // Tìm và update
    const updatedStatement = await Statement.findByIdAndUpdate(
      req.params.id,
      {
        transactionDate,
        type,
        amount,
        partnerName,
        description,
        balance,
        tags: tags || [] // Cập nhật danh sách tag mới
      },
      { new: true } // Trả về data mới sau khi update
    ).populate('tags'); // Populate để frontend hiển thị được ngay

    if (!updatedStatement) {
      return res.status(404).json({ msg: 'Statement not found' });
    }

    res.json(updatedStatement);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;