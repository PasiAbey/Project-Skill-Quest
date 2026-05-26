const axios = require('axios');
const { pool } = require('shared');

// RL API Base URL (replaces localhost:5001 with environment fallback)
const RL_API_URL = process.env.RL_API_URL || 'http://localhost:5001';

// Maps action_id numbers to codes the frontend uses
const ACTION_MAP = {
    0: { action_code: 'STANDARD_XP', action_name: 'Standard XP', description: 'Award normal XP points for activity' },
    1: { action_code: 'MULTIPLIER_BOOST', action_name: 'Multiplier Boost', description: 'Apply XP multiplier (2x, 3x) next activity' },
    2: { action_code: 'BADGE_INJECTION', action_name: 'Badge Injection', description: 'Award a surprise badge to boost motivation' },
    3: { action_code: 'RANK_COMPARISON', action_name: 'Rank Comparison', description: "Show 'X points to reach Top N' message" },
    4: { action_code: 'EXTRA_GOALS', action_name: 'Extra Goals', description: 'Set additional achievable micro-goals' }
};

class RLService {
    /**
     * Aggregates all necessary student metrics into a single payload for the RL Agent.
     */
    static async getStudentMetrics(studentId) {
        const [studentRows] = await pool.execute(
            `SELECT student_ID, level, total_xp, last_login 
             FROM student WHERE student_ID = ?`,
            [studentId]
        );

        if (studentRows.length === 0) {
            throw new Error('Student not found');
        }

        const student = studentRows[0];

        const [activeMinutesRows] = await pool.execute(
            `SELECT TIMESTAMPDIFF(MINUTE, last_login, NOW()) as active_minutes 
             FROM student WHERE student_ID = ?`,
            [studentId]
        );
        const activeMinutes = activeMinutesRows[0]?.active_minutes || 0;

        const [accuracyRows] = await pool.execute(
            `SELECT AVG(sub.accuracy) as quiz_accuracy FROM (
                SELECT week_number, step_ID, attempt_number, 
                       SUM(is_correct) / COUNT(*) as accuracy
                FROM quiz_attempts WHERE student_ID = ?
                GROUP BY week_number, step_ID, attempt_number
            ) sub`,
            [studentId]
        );
        const quizAccuracy = accuracyRows[0]?.quiz_accuracy || 0;

        const [daysRows] = await pool.execute(
            `SELECT DATEDIFF(CURDATE(), DATE(last_login)) as days_since 
             FROM student WHERE student_ID = ?`,
            [studentId]
        );
        const daysSinceLastLogin = daysRows[0]?.days_since || 0;

        const [dailyXpRows] = await pool.execute(
            `SELECT COUNT(DISTINCT step_ID) * 80 as daily_xp 
             FROM study_plan 
             WHERE student_ID = ? AND step_status = 'COMPLETED' 
             AND DATE(completed_at) = CURDATE()`,
            [studentId]
        );
        const dailyXp = dailyXpRows[0]?.daily_xp || 0;

        const [modulesDoneRows] = await pool.execute(
            `SELECT COUNT(DISTINCT step_ID) as modules_done 
             FROM study_plan 
             WHERE student_ID = ? AND step_status = 'COMPLETED' 
             AND DATE(completed_at) = CURDATE()`,
            [studentId]
        );
        const modulesDone = modulesDoneRows[0]?.modules_done || 0;

        const [recentPointsRows] = await pool.execute(
            `SELECT COUNT(DISTINCT step_ID) * 80 as recent_points
             FROM study_plan 
             WHERE student_ID = ? AND step_status = 'COMPLETED' 
             AND completed_at >= (SELECT last_login FROM student WHERE student_ID = ?)`,
            [studentId, studentId]
        );
        const recentPoints = recentPointsRows[0]?.recent_points || 0;

        const [badgesRows] = await pool.execute(
            `SELECT COUNT(*) as total_badges FROM student_badges WHERE student_ID = ?`,
            [studentId]
        );
        const totalBadges = badgesRows[0]?.total_badges || 0;

        const [sessionRows] = await pool.execute(
            `SELECT SUM(TIMESTAMPDIFF(SECOND, attempted_at, finished_at)) as session_duration
             FROM quiz_attempts 
             WHERE student_ID = ? 
             AND attempted_at >= (SELECT last_login FROM student WHERE student_ID = ?)`,
            [studentId, studentId]
        );
        const sessionDuration = sessionRows[0]?.session_duration || 0;

        const [quizScoreRows] = await pool.execute(
            `SELECT ROUND(AVG(score) * 100) as quiz_score 
             FROM quiz_attempts 
             WHERE student_ID = ? 
             ORDER BY attempted_at DESC LIMIT 10`,
            [studentId]
        );
        const quizScore = quizScoreRows[0]?.quiz_score || 0;

        const [consecutiveRows] = await pool.execute(
            `SELECT COUNT(DISTINCT step_ID) as consecutive 
             FROM study_plan 
             WHERE student_ID = ? AND step_status = 'COMPLETED'`,
            [studentId]
        );
        const consecutiveCompletions = consecutiveRows[0]?.consecutive || 1;

        const level = student.level
            ? student.level.charAt(0).toUpperCase() + student.level.slice(1)
            : 'Beginner';

        const expectedTime = 600;
        const durationNorm = Math.min(1.5, Math.max(0, sessionDuration) / expectedTime);

        return {
            user_id: studentId,
            level,
            active_minutes: Math.max(0, activeMinutes),
            quiz_accuracy: parseFloat(quizAccuracy) || 0,
            days_since_last_login: Math.max(0, daysSinceLastLogin),
            daily_xp: dailyXp,
            modules_done: modulesDone,
            recent_points: recentPoints,
            total_badges: totalBadges,
            total_badges_count: totalBadges,
            session_duration: Math.max(0, sessionDuration),
            duration_norm: durationNorm,
            quiz_score: quizScore,
            consecutive_completions: consecutiveCompletions,
            consecutive: consecutiveCompletions
        };
    }

    /**
     * Save an RL interaction to the database for tracking.
     */
    static async saveInteraction(studentId, interactionId, actionId, actionCode, riskScore = null) {
        try {
            const [result] = await pool.execute(
                `INSERT INTO rl_interactions 
                    (student_ID, interaction_id, action_id, action_code, risk_score, expires_at)
                 VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
                [studentId, interactionId, actionId, actionCode, riskScore]
            );

            console.log(`📝 Saved RL interaction: ${interactionId} for student ${studentId} (action: ${actionCode})`);
            return { id: result.insertId, interaction_id: interactionId };
        } catch (error) {
            console.error('Failed to save RL interaction:', error.message);
            return null;
        }
    }

    /**
     * Get the most recent pending (non-engaged, non-expired) interaction for a student.
     */
    static async getPendingInteraction(studentId) {
        try {
            const [rows] = await pool.execute(
                `SELECT * FROM rl_interactions 
                 WHERE student_ID = ? 
                   AND engaged IS NULL 
                   AND (expires_at IS NULL OR expires_at > NOW())
                 ORDER BY created_at DESC 
                 LIMIT 1`,
                [studentId]
            );

            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('Failed to get pending interaction:', error.message);
            return null;
        }
    }

    /**
     * Mark an interaction as engaged/ignored and send feedback to the RL API.
     */
    static async markEngaged(interactionId, engaged) {
        try {
            await pool.execute(
                `UPDATE rl_interactions 
                 SET engaged = ?, engaged_at = NOW() 
                 WHERE interaction_id = ? AND engaged IS NULL`,
                [engaged ? 1 : 0, interactionId]
            );

            let feedbackResult = null;
            let feedbackSent = false;

            try {
                const response = await axios.post(`${RL_API_URL}/feedback`, {
                    interaction_id: interactionId,
                    engaged: engaged ? true : false
                }, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 10000
                });

                feedbackResult = response.data;
                feedbackSent = true;
                console.log(`✅ RL feedback sent for ${interactionId}: engaged=${engaged}`);
            } catch (apiError) {
                console.error(`⚠️ RL feedback API failed for ${interactionId}:`, apiError.message);
            }

            await pool.execute(
                `UPDATE rl_interactions SET feedback_sent = ? WHERE interaction_id = ?`,
                [feedbackSent ? 1 : 0, interactionId]
            );

            return {
                success: true,
                interaction_id: interactionId,
                engaged,
                feedback_sent: feedbackSent,
                feedback: feedbackResult
            };
        } catch (error) {
            console.error('Failed to mark interaction as engaged:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get interaction history for a student
     */
    static async getInteractionHistory(studentId, limit = 20) {
        try {
            const [rows] = await pool.execute(
                `SELECT * FROM rl_interactions 
                 WHERE student_ID = ? 
                 ORDER BY created_at DESC 
                 LIMIT ?`,
                [studentId, limit]
            );
            return rows;
        } catch (error) {
            console.error('Failed to get interaction history:', error.message);
            return [];
        }
    }

    /**
     * Call RL API to get action recommendation.
     */
    static async getRecommendation(studentId) {
        try {
            const metrics = await this.getStudentMetrics(studentId);

            const response = await axios.post(`${RL_API_URL}/predict`, metrics, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 90000
            });

            const { action_id, interaction_id, risk_score } = response.data;
            const action = ACTION_MAP[action_id] || ACTION_MAP[0];

            await this.saveInteraction(
                studentId,
                interaction_id,
                action_id,
                action.action_code,
                risk_score
            );

            return {
                success: true,
                interaction_id,
                risk_score,
                recommendation: action
            };
        } catch (error) {
            console.error('RL API Error:', error.message);
            return {
                success: false,
                error: error.message,
                recommendation: ACTION_MAP[0] // Fallback: Standard XP
            };
        }
    }

    /**
     * Send feedback to RL API for training.
     */
    static async sendFeedback(studentId, engaged, interactionId = null) {
        try {
            if (!interactionId) {
                const pending = await this.getPendingInteraction(studentId);
                if (pending) {
                    interactionId = pending.interaction_id;
                    console.log(`🔍 Auto-resolved interaction_id from DB: ${interactionId}`);
                } else {
                    console.warn(`⚠️ No pending interaction found for student ${studentId}`);
                    return {
                        success: false,
                        error: 'No pending interaction found. The interaction may have expired.'
                    };
                }
            }

            return await this.markEngaged(interactionId, engaged);
        } catch (error) {
            console.error('RL Feedback Error:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Select a random unearned badge for a student
     */
    static async selectRandomBadge(studentId) {
        try {
            const [availableBadges] = await pool.execute(`
                SELECT b.* FROM badges b
                WHERE b.badge_id NOT IN (
                    SELECT badge_id FROM student_badges WHERE student_ID = ?
                )
                LIMIT 10
            `, [studentId]);

            if (availableBadges.length === 0) {
                console.log('No unearned badges available for student:', studentId);
                return null;
            }

            const randomBadge = availableBadges[Math.floor(Math.random() * availableBadges.length)];

            await pool.execute(`
                INSERT INTO student_badges (student_ID, badge_id, awarded_at)
                VALUES (?, ?, NOW())
            `, [studentId, randomBadge.badge_id]);

            console.log(`Awarded badge ${randomBadge.badge_id} to student ${studentId}`);
            return randomBadge;
        } catch (error) {
            console.error('Badge selection error:', error.message);
            return null;
        }
    }

    /**
     * Calculate student's rank percentile based on total_xp
     */
    static async calculateStudentRank(studentId) {
        try {
            const [totalResult] = await pool.execute('SELECT COUNT(*) as total FROM student');
            const totalStudents = totalResult[0].total;

            if (totalStudents === 0) return { percentile: 100, rank_text: 'Top 0%' };

            const [studentData] = await pool.execute(
                'SELECT total_xp FROM student WHERE student_ID = ?',
                [studentId]
            );

            if (studentData.length === 0) return { percentile: 0, rank_text: 'Unranked' };

            const studentXP = studentData[0].total_xp;

            const [rankResult] = await pool.execute(
                'SELECT COUNT(*) as students_below FROM student WHERE total_xp < ?',
                [studentXP]
            );

            const studentsBelowCount = rankResult[0].students_below;
            const percentile = Math.round((studentsBelowCount / totalStudents) * 100);

            const topPercentile = 100 - percentile;
            const rank_text = `Top ${topPercentile}%`;

            return { percentile: topPercentile, rank_text };
        } catch (error) {
            console.error('Rank calculation error:', error.message);
            return { percentile: 50, rank_text: 'Top 50%' };
        }
    }
}

module.exports = RLService;
