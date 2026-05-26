const { pool } = require('shared');

class GamificationService {
    static calculateLevel(totalXP) {
        if (totalXP < 0) return 0;
        return Math.floor(Math.sqrt(totalXP / 100));
    }

    static calculateXPForLevel(level) {
        if (level < 0) return 0;
        return level * level * 100;
    }

    static getLevelTitle(level) {
        if (level >= 50) return 'LEGENDARY MASTER';
        if (level >= 40) return 'GRANDMASTER';
        if (level >= 30) return 'MASTER';
        if (level >= 25) return 'EXPERT';
        if (level >= 20) return 'ELITE EXPLORER';
        if (level >= 15) return 'SKILLED LEARNER';
        if (level >= 10) return 'RISING STAR';
        if (level >= 5) return 'APPRENTICE';
        if (level >= 2) return 'NOVICE';
        return 'BEGINNER';
    }

    static daysDifference(date1, date2) {
        const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
        const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
        return Math.floor(Math.abs(utc1 - utc2) / (1000 * 60 * 60 * 24));
    }

    static async updateStreak(userId) {
        const today = new Date();

        const [rows] = await pool.execute(
            'SELECT current_streak, last_login FROM student WHERE student_ID = ?',
            [userId]
        );

        if (rows.length === 0) {
            throw new Error('User not found');
        }

        const { current_streak, last_login } = rows[0];
        let newStreak = current_streak || 0;
        let updated = false;

        if (!last_login) {
            newStreak = 1;
            updated = true;
        } else {
            const lastDate = new Date(last_login);
            const daysDiff = this.daysDifference(today, lastDate);

            if (daysDiff === 0) {
                updated = false;
            } else if (daysDiff === 1) {
                newStreak = (current_streak || 0) + 1;
                updated = true;
            } else {
                newStreak = 1;
                updated = true;
            }
        }

        if (updated) {
            await pool.execute(
                `UPDATE student 
                 SET current_streak = ?, 
                     last_login = ?,
                     longest_streak = GREATEST(COALESCE(longest_streak, 0), ?)
                 WHERE student_ID = ?`,
                [newStreak, today.toISOString().split('T')[0], newStreak, userId]
            );
        }

        return {
            streak: newStreak,
            updated
        };
    }

    static async getDashboardPayload(userId) {
        const [rows] = await pool.execute(
            'SELECT total_xp, current_level, current_streak, longest_streak, last_login, level FROM student WHERE student_ID = ?',
            [userId]
        );

        if (rows.length === 0) {
            throw new Error('User not found');
        }

        let { total_xp, current_streak, longest_streak, last_login, level } = rows[0];
        const totalXP = total_xp || 0;

        if (last_login && current_streak > 0) {
            const today = new Date();
            const lastDate = new Date(last_login);
            const daysDiff = this.daysDifference(today, lastDate);

            if (daysDiff > 1) {
                current_streak = 0;
                await pool.execute(
                    'UPDATE student SET current_streak = 0 WHERE student_ID = ?',
                    [userId]
                );
                console.log(`⚠️ Auto-reset stale streak for user ${userId}`);
            }
        }

        const currentLevel = this.calculateLevel(totalXP);
        const currentLevelXP = this.calculateXPForLevel(currentLevel);
        const nextLevelXP = this.calculateXPForLevel(currentLevel + 1);

        const xpIntoCurrentLevel = totalXP - currentLevelXP;
        const xpNeededForNextLevel = nextLevelXP - currentLevelXP;
        const progressPercentage = xpNeededForNextLevel > 0
            ? Math.min(100, Math.max(0, (xpIntoCurrentLevel / xpNeededForNextLevel) * 100))
            : 0;

        const levelTitle = this.getLevelTitle(currentLevel);

        return {
            currentLevel,
            currentXP: totalXP,
            currentLevelXP,
            nextLevelXP,
            xpToNextLevel: nextLevelXP - totalXP,
            progressPercentage: parseFloat(progressPercentage.toFixed(2)),
            currentStreak: current_streak || 0,
            longestStreak: longest_streak || 0,
            levelTitle,
            stage: level || 'beginner'
        };
    }

    static async addXP(userId, xpAmount) {
        const [rows] = await pool.execute(
            'SELECT total_xp, current_level FROM student WHERE student_ID = ?',
            [userId]
        );

        if (rows.length === 0) {
            throw new Error('User not found');
        }

        const oldXP = rows[0].total_xp || 0;
        const oldLevel = this.calculateLevel(oldXP);

        const newXP = oldXP + xpAmount;
        const newLevel = this.calculateLevel(newXP);

        await pool.execute(
            'UPDATE student SET total_xp = ?, current_level = ? WHERE student_ID = ?',
            [newXP, newLevel, userId]
        );

        const leveledUp = newLevel > oldLevel;

        return {
            previousXP: oldXP,
            newXP,
            xpGained: xpAmount,
            previousLevel: oldLevel,
            newLevel,
            leveledUp,
            levelTitle: this.getLevelTitle(newLevel)
        };
    }

    static async getDailyGoals(userId) {
        const today = new Date().toISOString().split('T')[0];

        const [stepsToday] = await pool.execute(
            `SELECT COUNT(DISTINCT CONCAT(week_number, '-', step_ID)) as completed_steps
             FROM quiz_attempts 
             WHERE student_ID = ? 
             AND DATE(finished_at) = ?
             AND is_correct = 1`,
            [userId, today]
        );

        const [sharpshooterToday] = await pool.execute(
            `SELECT COUNT(DISTINCT step_ID) as perfect_quizzes
             FROM study_plan 
             WHERE student_ID = ? 
             AND step_status = 'COMPLETED'
             AND attempt_count = 1
             AND DATE(completed_at) = ?`,
            [userId, today]
        );

        const [streakData] = await pool.execute(
            `SELECT current_streak, last_login FROM student WHERE student_ID = ?`,
            [userId]
        );

        const lastActivity = streakData[0]?.last_login;
        const lastActivityDate = lastActivity ? new Date(lastActivity).toISOString().split('T')[0] : null;
        const streakUpdatedToday = lastActivityDate === today;

        const stepsCompleted = stepsToday[0]?.completed_steps || 0;
        const perfectQuizzes = sharpshooterToday[0]?.perfect_quizzes || 0;

        const goals = [
            {
                id: 1,
                text: 'Complete today\'s learning item',
                progress: stepsCompleted > 0 ? 'COMPLETED!' : 'PROGRESS: 0/1',
                xp: '+100 XP',
                completed: stepsCompleted >= 1
            },
            {
                id: 2,
                text: 'Sharpshooter: Ace a quiz on first try',
                progress: perfectQuizzes > 0 ? 'COMPLETED!' : null,
                xp: '+500 XP',
                completed: perfectQuizzes > 0
            },
            {
                id: 3,
                text: 'Progress toward your weekly streak',
                progress: streakUpdatedToday ? 'STREAK MAINTAINED!' : null,
                xp: '+50 XP',
                completed: streakUpdatedToday
            }
        ];

        const completedGoals = goals.filter(g => g.completed).length;

        return {
            goals,
            completedGoals,
            totalGoals: 3,
            stepsCompletedToday: stepsCompleted,
            quizzesPassedToday: perfectQuizzes,
            streakMaintained: streakUpdatedToday
        };
    }

    static async getUserBadges(userId) {
        const [rows] = await pool.execute(
            `SELECT sb.awarded_at, b.badge_id, b.badge_name, b.badge_description, b.icon_url 
             FROM student_badges sb 
             JOIN badges b ON sb.badge_id = b.badge_id 
             WHERE sb.student_ID = ? 
             ORDER BY sb.awarded_at DESC`,
            [userId]
        );
        return rows;
    }
}

module.exports = GamificationService;
