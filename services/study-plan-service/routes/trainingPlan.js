const express = require('express');
const router = express.Router();
const { auth } = require('shared');
const { getStudentProgress, getWeekContent, generatePlan } = require('../controllers/trainingPlanController');

// @route   GET /progress
// @access  Private (Verified JWT required)
router.get('/progress', auth, getStudentProgress);

// @route   GET /week/:weekNumber
// @access  Private
router.get('/week/:weekNumber', auth, getWeekContent);

// @route   POST /generate
// @access  Public (Called internally by other services)
router.post('/generate', generatePlan);

module.exports = router;
