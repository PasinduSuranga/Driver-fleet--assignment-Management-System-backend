const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');

router.get('/vehicleCount', vehicleController.getVehicleCount);

module.exports = router;
