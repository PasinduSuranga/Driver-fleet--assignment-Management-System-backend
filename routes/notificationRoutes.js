const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

router.get('/expiryNotifications', notificationController.getExpiryNotifications);

module.exports = router;