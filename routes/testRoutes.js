const express = require('express');
const router = express.Router();
const testController = require('../controllers/testController');

// ==========================================
// Test Routes
// ==========================================

// Route to get all users (for testing/debugging purposes)
router.get('/users', testController.getAllUsers);

module.exports = router;