const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Report = require('../models/Report');
const User = require('../models/User');

// GET /api/reports
// Admin: Xem hết. Distributor: Xem của mình.
router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    
    if (req.user.role === 'DISTRIBUTOR') {
      query = { distributorId: req.user.id };
    }

    // Populate để lấy tên người phân phối và chi tiết sản phẩm nếu cần
    const reports = await Report.find(query)
      .populate('distributorId', 'name group') // Lấy thêm group để Admin lọc
      .populate('details.productId', 'name')
      .sort({ weekStartDate: -1 });

    // Format lại dữ liệu cho Frontend
    const formattedReports = reports.map(report => ({
      ...report._doc,
      id: report._id,
      distributorName: report.distributorId ? report.distributorId.name : 'Unknown',
      distributorGroup: report.distributorId ? report.distributorId.group : undefined,
    }));

    res.json(formattedReports);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// POST /api/reports - Tạo báo cáo tuần (DISTRIBUTOR ONLY)
router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'DISTRIBUTOR') {
    return res.status(403).json({ msg: 'Only Distributors can submit reports.' });
  }

  const { 
    weekStartDate, 
    totalRevenue, 
    totalSold, 
    totalDamaged, 
    details, 
    notes 
  } = req.body;

  try {
    // Kiểm tra xem đã có báo cáo cho tuần này chưa (Optional logic)
    // const existingReport = await Report.findOne({ distributorId: req.user.id, weekStartDate });
    // if (existingReport) return res.status(400).json({ msg: 'Report for this week already exists' });

    const newReport = new Report({
      distributorId: req.user.id, // Bắt buộc lấy từ Token, không tin dữ liệu client gửi
      weekStartDate,
      totalRevenue,
      totalSold,
      totalDamaged,
      details,
      notes,
      status: 'PENDING'
    });

    const report = await newReport.save();
    res.json(report);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// PUT /api/reports/:id - Sửa nội dung báo cáo (DISTRIBUTOR - Chỉ khi còn PENDING)
router.put('/:id', auth, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ msg: 'Report not found' });

    // Check quyền sở hữu
    if (report.distributorId.toString() !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(401).json({ msg: 'Not authorized' });
    }

    // Nếu là Distributor, chỉ cho sửa khi status là PENDING
    if (req.user.role === 'DISTRIBUTOR' && report.status !== 'PENDING') {
      return res.status(400).json({ msg: 'Cannot edit an approved or rejected report.' });
    }

    const { totalRevenue, totalSold, totalDamaged, details, notes } = req.body;

    report.totalRevenue = totalRevenue;
    report.totalSold = totalSold;
    report.totalDamaged = totalDamaged;
    report.details = details;
    report.notes = notes;

    await report.save();
    res.json(report);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// PUT /api/reports/:id/status - Duyệt báo cáo (ADMIN ONLY)
router.put('/:id/status', auth, async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ msg: 'Access denied. Admin only.' });
  }

  const { status } = req.body; // APPROVED or REJECTED

  try {
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status: status },
      { new: true }
    );
    
    if (!report) return res.status(404).json({ msg: 'Report not found' });

    // Có thể thêm logic: Nếu APPROVED thì cập nhật gì đó vào bảng KPI của Distributor?
    
    res.json(report);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;