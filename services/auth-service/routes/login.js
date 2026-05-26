const express = require('express');
const router = express.Router();
const { auth } = require('shared');
const { login, getMe } = require('../controllers/loginController');

// @route   POST /login
// @access  Public
router.post('/login', login);

// @route   GET /me
// @access  Private (Verified JWT required)
router.get('/me', auth, getMe);

module.exports = router;
