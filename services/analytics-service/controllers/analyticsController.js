const { pool } = require('shared');

const getWeeklyEngagement = async (req, res) => {
    try {
        const studentId = req.user.id;
        const dateRange = req.query.range || '7days';

        let daysBack = 7;
        if (dateRange === '14days') daysBack = 14;
        else if (dateRange === '30days') daysBack = 30;

        const [engagementData] = await pool.execute(
            `SELECT 
                DAYNAME(attempted_at) as day_name,
                DAYOFWEEK(attempted_at) as day_num,
                SUM(
                    GREATEST(0, 
                        TIMESTAMPDIFF(SECOND, attempted_at, 
                            COALESCE(finished_at, DATE_ADD(attempted_at, INTERVAL 5 MINUTE))
                        )
                    )
                ) / 3600 as hours
             FROM quiz_attempts 
             WHERE student_ID = ? 
               AND attempted_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
             GROUP BY DAYNAME(attempted_at), DAYOFWEEK(attempted_at)
             ORDER BY day_num`,
            [studentId, daysBack]
        );

        const dayMap = {};
        engagementData.forEach(row => {
            const shortDay = row.day_name.substring(0, 3);
            const hours = Number(row.hours) || 0;
            dayMap[shortDay] = Math.round(hours * 100) / 100;
        });

        const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const chartData = daysOfWeek.map(day => ({
            day: day,
            hours: dayMap[day] || 0
        }));

        const weeklyTotal = chartData.reduce((sum, d) => sum + d.hours, 0);
        const averageDaily = weeklyTotal / 7;

        let peakDay = 'None';
        let maxHours = 0;
        chartData.forEach(d => {
            if (d.hours > maxHours) {
                maxHours = d.hours;
                peakDay = getFullDayName(d.day);
            }
        });

        res.json({
            success: true,
            data: {
                chartData,
                summary: {
                    weeklyTotal: parseFloat(weeklyTotal.toFixed(1)),
                    averageDaily: parseFloat(averageDaily.toFixed(1)),
                    peakDay: peakDay
                }
            }
        });

    } catch (error) {
        console.error('Get weekly engagement error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch analytics data'
        });
    }
};

const getFullDayName = (shortDay) => {
    const dayNames = {
        'Mon': 'Monday',
        'Tue': 'Tuesday',
        'Wed': 'Wednesday',
        'Thu': 'Thursday',
        'Fri': 'Friday',
        'Sat': 'Saturday',
        'Sun': 'Sunday'
    };
    return dayNames[shortDay] || shortDay;
};

const getDailyXP = async (req, res) => {
    try {
        const studentId = req.user.id;
        const dateRange = req.query.range || '7days';

        let daysBack = 7;
        if (dateRange === '14days') daysBack = 14;
        else if (dateRange === '30days') daysBack = 30;

        const [attempts] = await pool.execute(
            `SELECT 
                DATE(finished_at) as date,
                DAYNAME(finished_at) as day_name,
                plan_id, 
                week_number, 
                step_ID, 
                attempt_number,
                SUM(score) as attempt_score,
                COUNT(*) as total_questions
             FROM quiz_attempts 
             WHERE student_ID = ? 
               AND finished_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
             GROUP BY date, day_name, plan_id, week_number, step_ID, attempt_number`,
            [studentId, daysBack]
        );

        const xpByDay = {};

        const today = new Date();
        for (let i = daysBack - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
            xpByDay[dayName] = 0;
        }

        attempts.forEach(attempt => {
            const score = Number(attempt.attempt_score);
            const total = Number(attempt.total_questions);

            const percentage = total > 0 ? (score / total) : 0;
            const passed = percentage >= 0.6;

            if (passed) {
                const xp = 50 + (score * 10);
                const shortDay = attempt.day_name.substring(0, 3);
                if (xpByDay[shortDay] !== undefined) {
                    xpByDay[shortDay] += xp;
                } else {
                    xpByDay[shortDay] = (xpByDay[shortDay] || 0) + xp;
                }
            }
        });

        const daysOfWeek = [];
        for (let i = daysBack - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            daysOfWeek.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
        }

        const chartData = daysOfWeek.map(day => ({
            day: day,
            xp: xpByDay[day] || 0
        }));

        res.json({
            success: true,
            data: chartData
        });

    } catch (error) {
        console.error('Get daily XP error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch XP analytics'
        });
    }
};

module.exports = { getWeeklyEngagement, getDailyXP };
