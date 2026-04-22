const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const uploadFields = upload.fields([
    { name: 'vehiclePhoto', maxCount: 1 },
    { name: 'bookCopyPhoto', maxCount: 1 },
    { name: 'licensePhoto', maxCount: 1 },
    { name: 'insurancePhoto', maxCount: 1 }
]);

// ==========================================
// Vehicle Management Routes
// ==========================================

// Route to fetch aggregate counts of vehicles
router.get('/vehicleCount', vehicleController.getVehicleCount);

// Route to fetch all active (non-blacklisted) vehicles
router.get('/vehicles', vehicleController.getVehicles);

// Route to register a new vehicle with its required documents
router.post('/add', uploadFields, vehicleController.addVehicle);

// Route to check if a vehicle registration number already exists
router.post('/checkRegistration', vehicleController.checkRegistration);

// Route to fetch comprehensive details of a specific vehicle
router.get('/vehicleDetails', vehicleController.getVehicleDetails);

// Route to update a vehicle's details and/or documents
router.put('/update', uploadFields, vehicleController.updateVehicle);

// Route to add a vehicle to the blacklist
router.put('/blacklist', vehicleController.addToBlacklist);

// Route to get all blacklisted vehicles
router.get('/blacklisted', vehicleController.getBlacklistedVehicles);

// Route to remove a vehicle from the blacklist
router.put('/unblacklist', vehicleController.removeFromBlacklist);

module.exports = router;
