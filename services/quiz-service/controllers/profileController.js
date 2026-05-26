const { classifyStudent, getClassification } = require('../services/ProfileClassifierService');

/**
 * Profile Classification Controller
 * Handles API endpoints for student profile classification (P10/P11/P12)
 */

const classify = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await classifyStudent(userId);

        res.json({
            success: true,
            message: `Student classified as ${result.level}`,
            classification: result
        });
    } catch (error) {
        console.error('Profile classification error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Classification failed. Please try again.'
        });
    }
};

const getReport = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await getClassification(userId);

        res.json({
            success: true,
            report: result
        });
    } catch (error) {
        console.error('Profile report error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get profile report.'
        });
    }
};

module.exports = { classify, getReport };
