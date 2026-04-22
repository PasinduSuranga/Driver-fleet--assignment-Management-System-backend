const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/adminController');

// ==========================================
// Admin Analytics Routes
// ==========================================

// Route to fetch comprehensive dashboard reports (e.g., margins, billings, driver earnings)
router.get('/dashboard', reportsController.getDashboardReports);

// Route to fetch key performance indicator (KPI) statistics for the admin dashboard
router.get('/stats', reportsController.getDashboardStats);

module.exports = router;