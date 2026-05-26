const express = require('express');
const router = express.Router();
const { auth } = require('shared');
const { generatePlan, getPlanStatus, regenerateStep, fillPlan } = require('../controllers/contentGenerationController');

// @route   POST /api/content/generate-plan
// @desc    Generate learning content + questions for a student via AI API (P13)
// @access  Private
router.post('/generate-plan', auth, generatePlan);

// @route   GET /api/content/status
// @desc    Check if the student already has a study plan
// @access  Private
router.get('/status', auth, getPlanStatus);

// @route   POST /api/content/regenerate-step
// @desc    Regenerate learning content and quiz for a specific step
// @access  Private
router.post('/regenerate-step', auth, regenerateStep);

// ==========================================
// CROSS-SERVICE INTERNAL ENDPOINTS
// ==========================================

// @route   POST /api/content/fill-plan
// @desc    Internal background endpoint to trigger batch content generation
// @access  Internal
router.post('/fill-plan', fillPlan);

module.exports = router;
