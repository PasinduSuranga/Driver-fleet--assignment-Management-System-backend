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

router.get('/driverCount', driverController.getDriverCount);

router.get('/list', driverController.getDrivers);

router.put('/blacklist', driverController.addToBlacklist);

router.post('/add', uploadFields, driverController.addDriver);

router.get('/driverDetails', driverController.getDriverDetails);

router.put('/update', uploadFields, driverController.updateDriver);

module.exports = router;