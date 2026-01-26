const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');

router.get('/assignmentCount', assignmentController.getAssignmentCount);

module.exports = router;