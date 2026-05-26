const { pool } = require('shared');
const PlanGeneratorService = require('../services/PlanGeneratorService');

/**
 * Get Student Progress (P13)
 */
const getStudentProgress = async (req, res) => {
    try {
        const studentId = req.user.id;

        const [weekStats] = await pool.execute(
            `SELECT 
                week_number,
                GROUP_CONCAT(DISTINCT module_name ORDER BY module_name SEPARATOR ', ') as module_name,
                COUNT(DISTINCT step_ID) as total_steps,
                COUNT(DISTINCT CASE WHEN step_status = 'COMPLETED' THEN step_ID END) as completed_steps,
                COUNT(DISTINCT CASE WHEN step_status = 'IN_PROGRESS' THEN step_ID END) as in_progress_steps
             FROM study_plan 
             WHERE student_ID = ?
             GROUP BY week_number
             ORDER BY week_number`,
            [studentId]
        );

        if (weekStats.length === 0) {
            return res.json({
                success: true,
                totalModules: 0,
                completedModules: 0,
                percentComplete: 0,
                currentModule: null,
                modules: []
            });
        }

        const [startDateResult] = await pool.execute(
            `SELECT MIN(start_date) as plan_start_date
             FROM study_plan 
             WHERE student_ID = ?`,
            [studentId]
        );

        const planStartDate = startDateResult[0]?.plan_start_date
            ? new Date(startDateResult[0].plan_start_date)
            : new Date();

        const today = new Date();
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;

        let modules = [];
        let completedModules = 0;
        let currentModule = null;

        for (let i = 0; i < weekStats.length; i++) {
            const week = weekStats[i];
            const isAllCompleted = week.completed_steps === week.total_steps;
            const hasInProgress = week.in_progress_steps > 0;
            const stepsRemaining = week.total_steps - week.completed_steps;

            const daysUntilUnlock = (week.week_number - 1) * 7;
            const startTimestamp = planStartDate.getTime();
            const validStart = isNaN(startTimestamp) ? Date.now() : startTimestamp;

            const unlockDate = new Date(validStart + (daysUntilUnlock * ONE_DAY_MS));
            const daysSincePlanStart = Math.floor((today - new Date(validStart)) / ONE_DAY_MS);
            const isTimeUnlocked = daysSincePlanStart >= daysUntilUnlock;

            let status;
            let daysRemaining = null;

            if (isAllCompleted) {
                status = 'COMPLETED';
                completedModules++;
            } else if (hasInProgress) {
                status = 'ACTIVE';

                if (!currentModule) {
                    currentModule = {
                        weekNumber: week.week_number,
                        name: week.module_name,
                        totalSteps: week.total_steps,
                        completedSteps: week.completed_steps,
                        stepsRemaining: stepsRemaining
                    };
                }
            } else if (isTimeUnlocked) {
                status = 'ACTIVE';

                if (!currentModule) {
                    currentModule = {
                        weekNumber: week.week_number,
                        name: week.module_name,
                        totalSteps: week.total_steps,
                        completedSteps: week.completed_steps,
                        stepsRemaining: stepsRemaining
                    };
                }
            } else {
                status = 'LOCKED';
                daysRemaining = daysUntilUnlock - daysSincePlanStart;
            }

            modules.push({
                weekNumber: week.week_number,
                name: week.module_name,
                status: status,
                totalSteps: week.total_steps,
                completedSteps: week.completed_steps,
                stepsRemaining: stepsRemaining,
                daysRemaining: daysRemaining
            });
        }

        const totalModules = weekStats.length;
        const percentComplete = totalModules > 0
            ? Math.round((completedModules / totalModules) * 100)
            : 0;

        res.json({
            success: true,
            totalModules,
            completedModules,
            percentComplete,
            currentModule,
            modules
        });

    } catch (error) {
        console.error('Get student progress error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch progress data'
        });
    }
};

/**
 * Get Week Content (P13 — Present Training Plan)
 */
const getWeekContent = async (req, res) => {
    try {
        const studentId = req.user.id;
        const weekNumber = parseInt(req.params.weekNumber);

        const [steps] = await pool.execute(
            `SELECT 
                step_ID,
                module_name,
                step_name,
                plan_id,
                gen_QID,
                learning_content,
                question,
                options,
                correct_answer,
                step_status,
                attempt_count
             FROM study_plan 
             WHERE student_ID = ? 
             AND week_number = ?
             AND plan_id = (SELECT MAX(plan_id) FROM study_plan WHERE student_ID = ?)
             ORDER BY step_ID, gen_QID`,
            [studentId, weekNumber, studentId]
        );

        if (steps.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No content found for this week'
            });
        }

        const stepsGrouped = {};
        steps.forEach(step => {
            if (!stepsGrouped[step.step_ID]) {
                let status = step.step_status;
                if (step.step_ID === 1 && status === 'LOCKED') {
                    status = 'IN_PROGRESS';
                }

                stepsGrouped[step.step_ID] = {
                    stepId: step.step_ID,
                    stepName: step.step_name || `Step ${step.step_ID}`,
                    planId: step.plan_id,
                    status: status,
                    learningContent: step.learning_content,
                    questions: []
                };
            }
            stepsGrouped[step.step_ID].questions.push({
                genQID: step.gen_QID,
                question: step.question,
                options: step.options,
                correctAnswer: step.correct_answer,
                attemptCount: step.attempt_count
            });
        });

        res.json({
            success: true,
            weekNumber: weekNumber,
            moduleName: steps[0].module_name,
            steps: Object.values(stepsGrouped)
        });

    } catch (error) {
        console.error('Get week content error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch week content'
        });
    }
};

/**
 * Generate Study Plan endpoint (HTTP POST)
 * Triggered from quiz-service microservice when assessment is completed
 */
const generatePlan = async (req, res) => {
    try {
        const { userId, weeks } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'Missing userId parameter' });
        }

        console.log(`[study-plan-service] Generating study plan for student ${userId}...`);
        const result = await PlanGeneratorService.generateFullPlan(userId, weeks || 4);

        res.json({
            success: true,
            message: 'Study plan generated successfully',
            planId: result.planId,
            totalWeeks: result.totalWeeks,
            totalRowsInserted: result.totalRowsInserted
        });
    } catch (error) {
        console.error('Generate study plan error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Study plan generation failed.'
        });
    }
};

module.exports = { getStudentProgress, getWeekContent, generatePlan };
