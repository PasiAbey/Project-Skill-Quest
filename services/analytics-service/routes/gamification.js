const express = require('express');
const router = Router = express.Router();
const { auth } = require('shared');
const {
    getDashboardStats,
    addXP,
    getDailyGoals,
    getUserBadges,
    internalAddXP,
    internalUpdateStreak
} = require('../controllers/gamificationController');

// @route   GET /api/gamification/dashboard
// @desc    Get main dashboard stats (Level, Streak, Progress)
// @access  Private
router.get('/dashboard', auth, getDashboardStats);

// @route   GET /api/gamification/daily-goals
// @desc    Get today's 3 assigned goals
// @access  Private
router.get('/daily-goals', auth, getDailyGoals);

// @route   GET /api/gamification/badges
// @desc    Get all earned badges
// @access  Private
router.get('/badges', auth, getUserBadges);

// @route   POST /api/gamification/add-xp
// @desc    Manually award XP (e.g., from external events)
// @access  Private
router.post('/add-xp', auth, addXP);

// ==========================================
// CROSS-SERVICE INTERNAL ENDPOINTS
// ==========================================

// @route   POST /api/gamification/xp
// @desc    Internal endpoint to add XP from other services
// @access  Internal
router.post('/xp', internalAddXP);

// @route   POST /api/gamification/streak
// @desc    Internal endpoint to update streak from other services
// @access  Internal
router.post('/streak', internalUpdateStreak);

module.exports = router;
