const express = require('express');
const router = express.Router();
const authenticationController = require('../controllers/authenticationController');

router.post('/userRegister', authenticationController.userRegister);

router.post('/adminRegister', authenticationController.adminRegister);

router.post('/login', authenticationController.login);

router.post('/forgetPassword', authenticationController.forgotPassword);

router.post('/verifyOTP', authenticationController.verifyOTP);

router.post('/resetPassword', authenticationController.resetPassword);

router.get('/getUsers/:id', authenticationController.getUser);

module.exports = router;