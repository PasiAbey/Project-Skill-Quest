const express = require('express');
const router = express.Router();
const { auth } = require('shared');
const {
    getRecommendation,
    getMetrics,
    sendFeedback,
    trackEngagement,
    getInteractionHistory,
    internalGetRecommendation,
    internalSendFeedback,
    internalBadgeInject,
    internalRankCalc
} = require('../controllers/rlController');

// @route   GET /api/rl/recommend
// @desc    Get personalized action (e.g., Badge Injection). Auto-saves interaction to DB.
// @access  Private
router.get('/recommend', auth, getRecommendation);

// @route   GET /api/rl/metrics
// @desc    Debug: View current student state vector
// @access  Private
router.get('/metrics', auth, getMetrics);

// @route   GET /api/rl/interactions
// @desc    View RL interaction history for debugging/analytics
// @access  Private
router.get('/interactions', auth, getInteractionHistory);

// @route   POST /api/rl/engage
// @desc    Track engagement: frontend calls this when user interacts with an RL action
// @access  Private
router.post('/engage', auth, trackEngagement);

// @route   POST /api/rl/feedback
// @desc    Report user engagement - supports both frontend (authenticated) and internal cross-service (unauthenticated)
// @access  Private/Internal
router.post('/feedback', (req, res, next) => {
    if (req.headers.authorization) {
        return auth(req, res, () => sendFeedback(req, res));
    } else {
        return internalSendFeedback(req, res);
    }
});

// ==========================================
// CROSS-SERVICE INTERNAL ENDPOINTS
// ==========================================

// @route   POST /api/rl/recommendation
// @desc    Internal endpoint to get recommendation
// @access  Internal
router.post('/recommendation', internalGetRecommendation);

// @route   POST /api/rl/badge-inject
// @desc    Internal endpoint to inject a badge
// @access  Internal
router.post('/badge-inject', internalBadgeInject);

// @route   POST /api/rl/rank-calc
// @desc    Internal endpoint to calculate rank
// @access  Internal
router.post('/rank-calc', internalRankCalc);

module.exports = router;
