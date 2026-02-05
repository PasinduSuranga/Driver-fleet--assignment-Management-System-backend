const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');

router.get('/driverCount', driverController.getDriverCount);

router.get('/list', driverController.getDrivers);

// Route to blacklist a driver
// Endpoint: /driver/blacklist
router.put('/blacklist', driverController.addToBlacklist);

module.exports = router;