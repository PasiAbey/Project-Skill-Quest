const express = require('express');
const router = express.Router();
const {
    verifyEmail, resendVerification,
    forgotPassword, resetPassword,
    verifyEmailChange
} = require('../controllers/emailController');

// @route   POST /verify-email
// @access  Public
router.post('/verify-email', verifyEmail);

// @route   POST /verify-email-change
// @access  Public
router.post('/verify-email-change', verifyEmailChange);

// @route   POST /resend-verification
// @access  Public
router.post('/resend-verification', resendVerification);

// @route   POST /forgot-password
// @access  Public
router.post('/forgot-password', forgotPassword);

// @route   POST /reset-password/:token
// @access  Public
router.post('/reset-password/:token', resetPassword);

module.exports = router;
