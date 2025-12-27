const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  // Lấy token từ header: "Authorization: Bearer <token>"
  const token = req.header('Authorization')?.split(' ')[1];
  
  if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user; // Gắn thông tin user vào request
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};