const express = require('express');
const router = express.Router();
const authenticationController = require('../controllers/authenticationController');

// ==========================================
// Authentication & User Management Routes
// ==========================================

// Route for standard users to register (requires admin approval)
router.post('/userRegister', authenticationController.userRegister);

// Route for admins to register (requires approval from another admin)
router.post('/adminRegister', authenticationController.adminRegister);

// Route for users and admins to authenticate and receive a JWT token
router.post('/login', authenticationController.login);

// Route to initiate password recovery via OTP
router.post('/forgetPassword', authenticationController.forgotPassword);

// Route to verify the OTP sent to the user's email
router.post('/verifyOTP', authenticationController.verifyOTP);

// Route to reset the password after successful OTP verification
router.post('/resetPassword', authenticationController.resetPassword);

// Route to fetch basic details of a specific user
router.get('/getUsers/:id', authenticationController.getUser);

// Route to fetch comprehensive profile details of a user
router.get('/details/:userId', authenticationController.getUserProfile);

// Route to update the user's password while logged in
router.put('/update-password', authenticationController.updatePassword);

// New 2-step email update routes
router.post('/request-email-update', authenticationController.requestEmailUpdate);
router.put('/verify-email-update', authenticationController.verifyEmailUpdate);

module.exports = router;