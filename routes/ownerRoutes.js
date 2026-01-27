const express = require('express');
const router = express.Router();
const ownerController = require('../controllers/ownerController');

router.get('/owners', ownerController.getAllOwners);

router.post('/add', ownerController.addOwner);

module.exports = router;