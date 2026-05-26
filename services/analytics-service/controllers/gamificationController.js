const GamificationService = require('../services/GamificationService');

const getDashboardStats = async (req, res) => {
    try {
        const userId = req.user.id;
        await GamificationService.updateStreak(userId);
        const dashboardData = await GamificationService.getDashboardPayload(userId);

        res.json({
            success: true,
            data: dashboardData
        });
    } catch (error) {
        console.error('Get dashboard stats error:', error);
        if (error.message === 'User not found') {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(500).json({ success: false, message: `Server error: ${error.message}` });
    }
};

const addXP = async (req, res) => {
    try {
        const userId = req.user.id;
        const { amount } = req.body;

        if (!amount || typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ success: false, message: 'Please provide a valid positive XP amount' });
        }

        const result = await GamificationService.addXP(userId, amount);
        await GamificationService.updateStreak(userId);

        res.json({
            success: true,
            message: result.leveledUp
                ? `Level Up! You've reached level ${result.newLevel}!`
                : `+${amount} XP earned!`,
            data: result
        });
    } catch (error) {
        console.error('Add XP error:', error);
        if (error.message === 'User not found') {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
};

const getDailyGoals = async (req, res) => {
    try {
        const userId = req.user.id;
        const goalsData = await GamificationService.getDailyGoals(userId);

        res.json({
            success: true,
            data: goalsData
        });
    } catch (error) {
        console.error('Get daily goals error:', error);
        res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
};

const getUserBadges = async (req, res) => {
    try {
        const userId = req.user.id;
        const badges = await GamificationService.getUserBadges(userId);

        res.json({
            success: true,
            data: badges
        });
    } catch (error) {
        console.error('Get user badges error:', error);
        res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
};

// ==========================================
// CROSS-SERVICE INTERNAL ENDPOINTS
// ==========================================

const internalAddXP = async (req, res) => {
    try {
        const { userId, xpAmount } = req.body;
        if (!userId || !xpAmount) {
            return res.status(400).json({ success: false, message: 'Missing userId or xpAmount' });
        }

        const result = await GamificationService.addXP(userId, xpAmount);
        res.json({ success: true, result });
    } catch (error) {
        console.error('[Internal] Add XP error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const internalUpdateStreak = async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'Missing userId' });
        }

        const result = await GamificationService.updateStreak(userId);
        res.json({ success: true, result });
    } catch (error) {
        console.error('[Internal] Update streak error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { 
    getDashboardStats, 
    addXP, 
    getDailyGoals, 
    getUserBadges,
    internalAddXP,
    internalUpdateStreak
};
