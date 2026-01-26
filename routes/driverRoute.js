const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');

router.get('/driverCount', driverController.getDriverCount);

module.exports = router;