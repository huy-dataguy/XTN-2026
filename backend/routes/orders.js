const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User'); // Import thêm User nếu cần check kỹ username
// GET: Lấy danh sách đơn hàng
router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    // Nếu là Distributor, chỉ lấy đơn của mình
    if (req.user.role === 'DISTRIBUTOR') {
      query = { distributorId: req.user.id };
    }
    // Populate để lấy tên User trong đơn hàng
    const orders = await Order.find(query).populate('distributorId', 'name').sort({ createdAt: -1 });
    
    // Map dữ liệu để khớp với Frontend interface nếu cần
    const formattedOrders = orders.map(order => ({
      ...order._doc,
      id: order._id, // Frontend dùng 'id', Mongo dùng '_id'
      distributorName: order.distributorId?.name
    }));

    res.json(formattedOrders);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// POST: Tạo đơn hàng (Cho Distributor)
router.post('/', auth, async (req, res) => {
  const { items } = req.body; // items: [{ productId, quantity }]
  try {
    let totalAmount = 0;
    const orderItems = [];

    // Tính tiền Server-side để bảo mật (không tin client gửi giá lên)
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) return res.status(404).json({ msg: `Product ${item.productId} not found` });
      
      if (product.stock < item.quantity) {
          return res.status(400).json({ msg: `Not enough stock for ${product.name}`});
      }

      orderItems.push({
        productId: product._id,
        productName: product.name,
        price: product.price,
        quantity: item.quantity
      });
      totalAmount += product.price * item.quantity;
      
      // Trừ kho ngay lập tức (hoặc trừ khi Admin duyệt - tùy logic business)
      product.stock -= item.quantity;
      await product.save();
    }

    const newOrder = new Order({
      distributorId: req.user.id,
      items: orderItems,
      totalAmount,
      status: 'PENDING'
    });

    const order = await newOrder.save();
    res.json(order);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// PUT: Cập nhật trạng thái (Cho Admin)
router.put('/:id/status', auth, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ msg: 'Access denied' });
  
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id, 
      { status: req.body.status },
      { new: true }
    );
    res.json(order);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});


// --- NEW: API cập nhật trạng thái đã nhận hàng ---
// PUT: /api/orders/:id/received
router.put('/:id/received', auth, async (req, res) => {
  try {
    const { isReceived } = req.body; // Lấy giá trị true/false từ client gửi lên

    // Tìm và update
    const order = await Order.findByIdAndUpdate(
      req.params.id, 
      { isReceived: isReceived },
      { new: true } // Trả về data mới sau khi update
    );

    if (!order) {
        return res.status(404).json({ msg: 'Order not found' });
    }

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// DELETE: Xóa đơn hàng
router.delete('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ msg: 'Order not found' });
    }

    // Kiểm tra quyền: Chỉ Admin hoặc chính chủ (Distributor) mới được xóa
    if (req.user.role !== 'ADMIN' && order.distributorId.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    // Logic nghiệp vụ (Optional): 
    // Nếu đơn hàng đã duyệt (APPROVED) hoặc đang giao, Distributor không được tự ý xóa
    if (req.user.role !== 'ADMIN' && order.status !== 'PENDING') {
       return res.status(400).json({ msg: 'Cannot delete processed order' });
    }

    // --- QUAN TRỌNG: Hoàn lại số lượng tồn kho (Restock) ---
    // Vì lúc tạo đơn đã trừ kho, nên khi xóa đơn phải cộng lại.
    for (const item of order.items) {
      await Product.findByIdAndUpdate(
        item.productId, 
        { $inc: { stock: item.quantity } } // $inc: increment (cộng thêm)
      );
    }

    // Thực hiện xóa
    await Order.findByIdAndDelete(req.params.id);

    res.json({ msg: 'Order removed' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// PUT: /api/orders/:id/date
router.put('/:id/date', auth, async (req, res) => {
  try {
    // 1. Kiểm tra quyền: Chỉ cho phép username "admin0"
    // Lưu ý: req.user lấy từ token. Nếu token của bạn không chứa username, 
    // bạn cần query DB để lấy username: const user = await User.findById(req.user.id);
    
    // Giả sử req.user có chứa username hoặc ta query lại cho chắc chắn:
    const currentUser = await User.findById(req.user.id);

    if (!currentUser || currentUser.username !== 'admin0') {
        return res.status(403).json({ msg: 'Access denied. Only admin0 can change order date.' });
    }

    const { date } = req.body; // Client gửi lên chuỗi ISO Date

    // 2. Tìm và update
    const order = await Order.findByIdAndUpdate(
      req.params.id, 
      { createdAt: date }, // Mongoose tự hiểu chuỗi ISO string gán vào Date
      { new: true }
    );

    if (!order) {
        return res.status(404).json({ msg: 'Order not found' });
    }

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});
module.exports = router;