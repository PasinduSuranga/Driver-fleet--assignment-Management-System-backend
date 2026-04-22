const express = require('express');
const router = express.Router();
const ownerController = require('../controllers/ownerController');

// ==========================================
// Vehicle Owner Routes
// ==========================================

// Route to retrieve all registered vehicle owners
router.get('/owners', ownerController.getAllOwners);

// Route to register a new vehicle owner
router.post('/add', ownerController.addOwner);

module.exports = router;