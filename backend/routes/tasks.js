const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Task = require('../models/Task');
const User = require('../models/User');

// GET: Lấy toàn bộ danh sách Task
router.get('/', auth, async (req, res) => {
  try {
    // Populate để lấy tên người được giao việc
    const tasks = await Task.find()
      .populate('assignee', 'name email')
      .populate('creator', 'name')
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// POST: Tạo Task mới
router.post('/', auth, async (req, res) => {
  const { title, description, assigneeId, priority, dueDate, status } = req.body;
  try {
    const newTask = new Task({
      title,
      description,
      priority,
      dueDate,
      status: status || 'TODO',
      assignee: assigneeId || null,
      creator: req.user.id
    });

    const task = await newTask.save();
    await task.populate('assignee', 'name email');
    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// PUT: Cập nhật trạng thái Task (Kéo thả Kanban)
router.put('/:id/status', auth, async (req, res) => {
  const { status } = req.body; // 'TODO', 'IN_PROGRESS', ...
  try {
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { status: status, updatedAt: Date.now() },
      { new: true }
    ).populate('assignee', 'name');
    
    res.json(task);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// DELETE: Xóa Task
router.delete('/:id', auth, async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Task removed' });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

module.exports = router;