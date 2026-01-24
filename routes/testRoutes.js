const express = require('express');
const router = express.Router();
const testController = require('../controllers/testController');

// Route to get all users
router.get('/users', testController.getAllUsers);

module.exports = router;