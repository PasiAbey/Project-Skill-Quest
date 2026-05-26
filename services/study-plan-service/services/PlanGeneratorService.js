const axios = require('axios');
const { pool } = require('shared');

// RL Personalization API URL
const RL_PERSONALIZE_API_URL = process.env.RL_PERSONALIZE_API_URL || 'https://amayasanduni-personalization-model.hf.space';

class PlanGeneratorService {
    /**
     * Builds the payload for the RL Personalization API from the student's database record.
     */
    static async buildPayload(studentId) {
        const [rows] = await pool.execute(
            `SELECT at_score, ct_score, p_score, level 
             FROM student 
             WHERE student_ID = ?`,
            [studentId]
        );

        if (rows.length === 0) {
            throw new Error('Student not found');
        }

        const s = rows[0];

        const current_scores = [
            parseFloat(s.at_score) || 0.0,
            parseFloat(s.ct_score) || 0.0,
            parseFloat(s.p_score) || 0.0
        ];

        const [accuracyRows] = await pool.execute(
            `SELECT AVG(sub.accuracy) as quiz_accuracy FROM (
                SELECT week_number, step_ID, attempt_number, 
                       SUM(is_correct) / COUNT(*) as accuracy
                FROM quiz_attempts WHERE student_ID = ?
                GROUP BY week_number, step_ID, attempt_number
            ) sub`,
            [studentId]
        );
        const quiz_score = parseFloat(accuracyRows[0]?.quiz_accuracy) || 0.0;

        const [engagementRows] = await pool.execute(
            `SELECT 
                COUNT(CASE WHEN step_status = 'COMPLETED' THEN 1 END) as completed,
                COUNT(*) as total
             FROM study_plan 
             WHERE student_ID = ?`,
            [studentId]
        );
        const completed = engagementRows[0]?.completed || 0;
        const total = engagementRows[0]?.total || 1;
        const engagement = Math.min(1.0, completed / total);

        const user_level = s.level
            ? s.level.charAt(0).toUpperCase() + s.level.slice(1)
            : 'Beginner';

        return {
            current_scores,
            user_level,
            quiz_score: Math.round(quiz_score * 100) / 100,
            engagement: Math.round(engagement * 100) / 100
        };
    }

    /**
     * Calls the RL Personalization API to generate a weekly plan.
     */
    static async generateWeekPlan(studentId) {
        try {
            const payload = await this.buildPayload(studentId);

            console.log(`[PlanGen] Requesting plan for ${studentId} with payload:`, JSON.stringify(payload));

            const response = await axios.post(`${RL_PERSONALIZE_API_URL}/generate-plan`, payload, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 120000
            });

            console.log('[PlanGen] ✅ Plan generated successfully');

            if (response.data.monitor_report) {
                console.log('[PlanGen] Monitor Report:', JSON.stringify(response.data.monitor_report));
            }

            return response.data;

        } catch (error) {
            const status = error.response?.status;
            const detail = error.response?.data?.detail || error.message;
            console.error(`[PlanGen] ❌ API Error ${status || 'N/A'}: ${JSON.stringify(detail)}`);
            throw new Error(`Plan generation API failed: ${JSON.stringify(detail)}`);
        }
    }

    /**
     * Saves one week's API response into the study_plan table.
     */
    static async saveWeekPlan(studentId, weekNumber, planId, apiResponse) {
        const weeklyPlan = apiResponse.weekly_plan;
        if (!weeklyPlan) {
            throw new Error('API response missing weekly_plan');
        }

        let rowsInserted = 0;

        for (const dayData of weeklyPlan) {
            const stepId = dayData.day || (rowsInserted + 1);
            const moduleName = dayData.category || 'General';
            const stepName = dayData.topic || `Day ${stepId}`;

            const stepStatus = (weekNumber === 1 && stepId === 1) ? 'IN_PROGRESS' : 'LOCKED';

            await pool.execute(
                `INSERT INTO study_plan
                 (plan_id, student_ID, week_number, step_ID, module_name, step_name,
                  gen_QID, learning_content, question, options, correct_answer,
                  step_status, attempt_count, start_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?, '', '', '[]', '', ?, 0, NOW())`,
                [planId, studentId, weekNumber, stepId, moduleName, stepName, `Q_W${weekNumber}_S${stepId}_0`, stepStatus]
            );
            rowsInserted++;
        }

        console.log(`[PlanGen] ✅ Week ${weekNumber}: inserted ${rowsInserted} rows (planId: ${planId})`);
        return rowsInserted;
    }

    /**
     * Generates a full multi-week study plan
     */
    static async generateFullPlan(studentId, totalWeeks = 4) {
        const [planIdResult] = await pool.execute(
            'SELECT MAX(plan_id) as maxPlanId FROM study_plan'
        );
        const planId = (planIdResult[0].maxPlanId || 0) + 1;

        let totalRowsInserted = 0;
        const weeklyPlans = [];

        for (let week = 1; week <= totalWeeks; week++) {
            console.log(`[PlanGen] Generating week ${week}/${totalWeeks} for student ${studentId}...`);

            const apiResponse = await this.generateWeekPlan(studentId);
            const rowsInserted = await this.saveWeekPlan(studentId, week, planId, apiResponse);

            totalRowsInserted += rowsInserted;
            weeklyPlans.push({
                weekNumber: week,
                rowsInserted,
                plan: apiResponse.weekly_plan,
                monitorReport: apiResponse.monitor_report || null
            });
        }

        console.log(`[PlanGen] ✅ Full plan complete: ${totalWeeks} weeks, ${totalRowsInserted} total rows`);

        // Chain content generation in background (fire-and-forget) via HTTP call to ai-service
        try {
            fetch('http://ai-service:5005/api/content/fill-plan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ studentId, planId })
            })
            .then(async response => {
                const data = await response.json();
                if (data.success) {
                    console.log(`[PlanGen] ✅ Background content generation triggered successfully: ${data.stepsFilled} steps filled.`);
                }
            })
            .catch(e => console.error(`[PlanGen] ❌ Background content generation trigger failed:`, e.message));
        } catch (err) {
            console.error(`[PlanGen] ❌ Background content generation fetch setup failed:`, err.message);
        }

        return { planId, totalWeeks, totalRowsInserted, weeklyPlans };
    }
}

module.exports = PlanGeneratorService;
