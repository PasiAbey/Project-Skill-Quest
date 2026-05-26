const express = require('express');
const router = express.Router();
const { register } = require('../controllers/registrationController');

// @route   POST /register
// @access  Public
router.post('/register', register);

module.exports = router;
