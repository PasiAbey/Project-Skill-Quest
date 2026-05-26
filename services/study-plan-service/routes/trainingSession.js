const express = require('express');
const router = express.Router();
const { auth } = require('shared');
const { getStepContent, submitStepQuiz, saveStepResponse, clearStepResponses } = require('../controllers/trainingSessionController');

// @route   GET /step/:weekNumber/:stepId
// @access  Private (Verified JWT required)
router.get('/step/:weekNumber/:stepId', auth, getStepContent);

// @route   POST /save-response
// @access  Private
router.post('/save-response', auth, saveStepResponse);

// @route   POST /clear-responses
// @access  Private
router.post('/clear-responses', auth, clearStepResponses);

// @route   POST /submit-quiz
// @access  Private
router.post('/submit-quiz', auth, submitStepQuiz);

module.exports = router;
