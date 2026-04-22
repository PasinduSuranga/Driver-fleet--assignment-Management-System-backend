const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const uploadFields = upload.fields([
  { name: "licenseFrontPhoto", maxCount: 1 },
  { name: "licenseBackPhoto", maxCount: 1 },
]);

// ==========================================
// Driver Management Routes
// ==========================================

// Route to get the total count of drivers in the system
router.get('/driverCount', driverController.getDriverCount);

// Route to get a list of all active (non-blacklisted) drivers
router.get('/list', driverController.getDrivers);

// Route to add a specific driver to the blacklist
router.put('/blacklist', driverController.addToBlacklist);

// Route to register a new driver with their license photos
router.post('/add', uploadFields, driverController.addDriver);

// Route to get detailed information about a specific driver
router.get('/driverDetails', driverController.getDriverDetails);

// Route to update an existing driver's details and photos
router.put('/update', uploadFields, driverController.updateDriver);

// Route to get a list of all blacklisted drivers
router.get('/blacklisted', driverController.getBlacklistedDrivers);

// Route to remove a specific driver from the blacklist
router.put('/unblacklist', driverController.removeFromBlacklist);

module.exports = router;