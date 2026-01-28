const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Route to get main list (Pending & Approved)
router.get('/list', userController.getUsers);

// Route to get blacklist
router.get('/blacklist', userController.getBlacklistedUsers);

// Route to change status
router.post('/status', userController.updateUserStatus);

module.exports = router;