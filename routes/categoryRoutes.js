const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

// ==========================================
// Vehicle Category Routes
// ==========================================

// Route to fetch all available vehicle categories
router.get('/categories', categoryController.getCategories);

// Route to create a new vehicle category
router.post('/categories', categoryController.addCategory);

module.exports = router;