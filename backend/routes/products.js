const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Product = require('../models/Product');

// GET /api/products
// Ai cũng có thể xem danh sách sản phẩm (có thể bỏ middleware auth nếu muốn public hoàn toàn)
router.get('/', auth, async (req, res) => {
  try {
    const products = await Product.find();
    
    // Map _id thành id cho frontend dễ dùng
    const formattedProducts = products.map(p => ({
      id: p._id,
      name: p.name,
      price: p.price,
      stock: p.stock,
      category: p.category,
      image: p.image
    }));

    res.json(formattedProducts);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// GET /api/products/:id - Xem chi tiết 1 sản phẩm
router.get('/:id', auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ msg: 'Product not found' });
    res.json({ ...product._doc, id: product._id });
  } catch (err) {
    if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Product not found' });
    res.status(500).send('Server Error');
  }
});

// POST /api/products - Thêm sản phẩm mới (ADMIN ONLY)
router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ msg: 'Access denied. Admin only.' });
  }

  const { name, price, stock, category, image } = req.body;

  try {
    const newProduct = new Product({
      name,
      price,
      stock,
      category,
      image
    });

    const product = await newProduct.save();
    res.json(product);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// PUT /api/products/:id - Cập nhật sản phẩm (ADMIN ONLY)
router.put('/:id', auth, async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ msg: 'Access denied. Admin only.' });
  }

  const { name, price, stock, category, image } = req.body;

  // Xây dựng object update
  const productFields = {};
  if (name) productFields.name = name;
  if (price) productFields.price = price;
  if (stock !== undefined) productFields.stock = stock;
  if (category) productFields.category = category;
  if (image) productFields.image = image;

  try {
    let product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ msg: 'Product not found' });

    product = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: productFields },
      { new: true }
    );

    res.json(product);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// DELETE /api/products/:id - Xóa sản phẩm (ADMIN ONLY)
router.delete('/:id', auth, async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ msg: 'Access denied. Admin only.' });
  }

  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ msg: 'Product not found' });

    await Product.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Product removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;