const express = require('express');
const router = express.Router();
const { auth } = require('shared');
const {
    getInitialQuiz,
    submitAnswer,
    completeQuiz
} = require('../controllers/quizController');

// @route   GET /initial
// @access  Private (Verified JWT required)
router.get('/initial', auth, getInitialQuiz);

// @route   POST /answer
// @access  Private
router.post('/answer', auth, submitAnswer);

// @route   POST /complete
// @access  Private
router.post('/complete', auth, completeQuiz);

module.exports = router;
