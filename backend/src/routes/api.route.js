const express = require('express');
const router = express.Router();

const analyticsController = require('../controllers/analytics.controller');
const alertsController = require('../controllers/alerts.controller'); // Sửa thành alertsController (có s) cho đồng bộ

// GET /api/v1/analytics
router.get('/analytics', analyticsController.getAnalyticsData);

// GET /api/v1/alerts
router.get('/alerts', alertsController.getLiveAlerts); // Dùng alertsController

// Các route mới cho Bronze layer
router.get('/alerts/bronze', alertsController.getBronzeAlerts);
router.delete('/alerts/:id', alertsController.deleteAlert);

module.exports = router;