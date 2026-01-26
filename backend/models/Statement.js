const mongoose = require('mongoose');

const StatementSchema = new mongoose.Schema({
  // Ngày giao dịch (cho phép chọn ngày cũ để nhập lại data)
  transactionDate: { type: Date, required: true, default: Date.now },
  
  // Loại giao dịch: IN (Tiền vào/Nộp tiền), OUT (Tiền ra/Rút/Chuyển)
  type: { type: String, enum: ['IN', 'OUT'], required: true },
  
  // Số tiền
  amount: { type: Number, required: true },
  
  // Đối tác (Người gửi hoặc Người nhận)
  partnerName: { type: String, required: true },
  
  // Nội dung chuyển khoản
  description: { type: String },
  
  // Số dư (Nhập tay để khớp với sao kê ngân hàng lúc đó)
  balance: { type: Number, required: true },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Statement1', StatementSchema);