const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// ==========================================
// Notification & Alert Routes
// ==========================================

// Route to fetch upcoming document/license expiries for UI updates
router.get('/expiryNotifications', notificationController.getExpiryNotifications);

// Route to get a complete list of all notifications
router.get('/allNotifications', notificationController.getAllNotifications);

// Route to manually trigger the daily expiry SMS/Email alerts
router.get("/sendAlerts", notificationController.sendExpiryAlerts);

module.exports = router;