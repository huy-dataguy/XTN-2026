const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  
  // Người được giao việc (Assignee)
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
  
  // Người tạo (Admin tạo task)
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  status: { 
    type: String, 
    enum: ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'], 
    default: 'TODO' 
  },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
  
  // --- [QUAN TRỌNG] THỜI GIAN ---
  startDate: { type: Date, default: Date.now }, // Ngày bắt đầu
  dueDate: { type: Date }, // Hạn chót (Deadline)

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Task', TaskSchema);