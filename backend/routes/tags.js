const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Tag = require('../models/Tag');

// GET: Lấy tất cả tags
router.get('/', auth, async (req, res) => {
  try {
    const tags = await Tag.find().sort({ createdAt: 1 });
    res.json(tags);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// POST: Tạo tag mới
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ msg: 'Access denied' });
    const { name, color } = req.body;
    const newTag = new Tag({ name, color });
    const savedTag = await newTag.save();
    res.json(savedTag);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// PUT: Sửa tag
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ msg: 'Access denied' });
    const { name, color } = req.body;
    const updatedTag = await Tag.findByIdAndUpdate(req.params.id, { name, color }, { new: true });
    res.json(updatedTag);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// DELETE: Xóa tag
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') return res.status(403).json({ msg: 'Access denied' });
    await Tag.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Tag removed' });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

module.exports = router;