const express = require('express');
const router = express.Router();
const { auth } = require('shared');
const { classify, getReport } = require('../controllers/profileController');

// @route   POST /classify
// @access  Private (Verified JWT required)
router.post('/classify', auth, classify);

// @route   GET /report
// @access  Private
router.get('/report', auth, getReport);

module.exports = router;
