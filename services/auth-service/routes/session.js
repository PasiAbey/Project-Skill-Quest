const express = require('express');
const router = express.Router();
const { logExit } = require('../controllers/sessionController');

// @route   POST /log-exit
// @access  Public (No auth headers allowed since it's triggered via navigator.sendBeacon)
router.post('/log-exit', logExit);

module.exports = router;
