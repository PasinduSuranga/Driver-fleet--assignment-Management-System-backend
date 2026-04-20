const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

router.get('/expiryNotifications', notificationController.getExpiryNotifications);

router.get('/allNotifications', notificationController.getAllNotifications);

router.get("/sendAlerts", notificationController.sendExpiryAlerts);

module.exports = router;