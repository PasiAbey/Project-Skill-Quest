const RLService = require('../services/RLService');

const getRecommendation = async (req, res) => {
    try {
        const studentId = req.user.id;
        const result = await RLService.getRecommendation(studentId);
        res.json(result);
    } catch (error) {
        console.error('RL Recommendation Error:', error);
        res.status(500).json({ success: false, error: 'Failed to get recommendation' });
    }
};

const getMetrics = async (req, res) => {
    try {
        const studentId = req.user.id;
        const metrics = await RLService.getStudentMetrics(studentId);
        res.json({ success: true, metrics });
    } catch (error) {
        console.error('RL Metrics Error:', error);
        if (error.message === 'Student not found') {
            return res.status(404).json({ success: false, error: 'Student not found' });
        }
        res.status(500).json({ success: false, error: 'Failed to get metrics' });
    }
};

const sendFeedback = async (req, res) => {
    try {
        const studentId = req.user.id;
        const { engaged, interactionId } = req.body;

        if (typeof engaged !== 'boolean') {
            return res.status(400).json({ success: false, error: 'Missing required field: engaged (boolean)' });
        }

        const result = await RLService.sendFeedback(studentId, engaged, interactionId);
        res.json(result);
    } catch (error) {
        console.error('RL Feedback Error:', error);
        res.status(500).json({ success: false, error: 'Failed to send feedback' });
    }
};

const trackEngagement = async (req, res) => {
    try {
        const studentId = req.user.id;
        const { actionCode, interactionId } = req.body;

        let resolvedInteractionId = interactionId || null;

        if (!resolvedInteractionId) {
            const pending = await RLService.getPendingInteraction(studentId);
            if (!pending) {
                return res.status(404).json({
                    success: false,
                    error: 'No pending RL interaction found for this user. It may have expired.'
                });
            }
            resolvedInteractionId = pending.interaction_id;
        }

        const result = await RLService.markEngaged(resolvedInteractionId, true);

        res.json({
            success: result.success,
            message: result.success ? 'Engagement tracked and feedback sent to RL model' : 'Failed to track engagement',
            data: {
                interaction_id: resolvedInteractionId,
                feedback_sent: result.feedback_sent || false
            }
        });
    } catch (error) {
        console.error('RL Engagement Tracking Error:', error);
        res.status(500).json({ success: false, error: 'Failed to track engagement' });
    }
};

const getInteractionHistory = async (req, res) => {
    try {
        const studentId = req.user.id;
        const limit = parseInt(req.query.limit) || 20;
        const interactions = await RLService.getInteractionHistory(studentId, limit);

        res.json({
            success: true,
            count: interactions.length,
            data: interactions
        });
    } catch (error) {
        console.error('RL Interaction History Error:', error);
        res.status(500).json({ success: false, error: 'Failed to get interaction history' });
    }
};

// ==========================================
// CROSS-SERVICE INTERNAL ENDPOINTS
// ==========================================

const internalGetRecommendation = async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'Missing userId' });
        }

        const result = await RLService.getRecommendation(userId);
        res.json(result);
    } catch (error) {
        console.error('[Internal] RL Recommendation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const internalSendFeedback = async (req, res) => {
    try {
        const { userId, engaged, recommendationId } = req.body;
        if (!userId || typeof engaged !== 'boolean' || !recommendationId) {
            return res.status(400).json({ success: false, message: 'Missing fields' });
        }

        const result = await RLService.sendFeedback(userId, engaged, recommendationId);
        res.json(result);
    } catch (error) {
        console.error('[Internal] RL Feedback error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const internalBadgeInject = async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'Missing userId' });
        }

        const badge = await RLService.selectRandomBadge(userId);
        if (badge) {
            res.json({
                success: true,
                badge: {
                    badge_id: badge.badge_id,
                    name: badge.badge_name,
                    description: badge.badge_description,
                    icon_url: badge.icon_url
                }
            });
        } else {
            res.json({ success: false, message: 'No unearned badges available' });
        }
    } catch (error) {
        console.error('[Internal] Badge injection error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const internalRankCalc = async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'Missing userId' });
        }

        const result = await RLService.calculateStudentRank(userId);
        res.json({
            success: true,
            percentile: result.percentile,
            rank_text: result.rank_text
        });
    } catch (error) {
        console.error('[Internal] Rank calculation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = { 
    getRecommendation, 
    getMetrics, 
    sendFeedback, 
    trackEngagement, 
    getInteractionHistory,
    internalGetRecommendation,
    internalSendFeedback,
    internalBadgeInject,
    internalRankCalc
};
