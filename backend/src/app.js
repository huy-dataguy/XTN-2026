const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/api.route');

const app = express();

// Middleware
app.use(cors()); // Bật CORS cho React
app.use(express.json());

// Routes
// Prefix '/api/v1' giúp quản lý version API tốt hơn
app.use('/api/v1', apiRoutes);

// Xử lý lỗi 404 Not Found
app.use((req, res, next) => {
    res.status(404).json({
        status: 'error',
        message: 'Endpoint not found'
    });
});

module.exports = app;