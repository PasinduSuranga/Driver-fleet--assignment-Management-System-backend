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

router.get('/vehicleCount', vehicleController.getVehicleCount);

router.get('/vehicles', vehicleController.getVehicles);

router.post('/add', uploadFields, vehicleController.addVehicle);

router.post('/checkRegistration', vehicleController.checkRegistration);

router.get('/vehicleDetails', vehicleController.getVehicleDetails);

router.put('/update', uploadFields, vehicleController.updateVehicle);

module.exports = router;
