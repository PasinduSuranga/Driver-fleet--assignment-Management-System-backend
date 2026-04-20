const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/adminController');

// Main Analytics Dashboard Route
router.get('/dashboard', reportsController.getDashboardReports);

router.get('/stats', reportsController.getDashboardStats);

module.exports = router;