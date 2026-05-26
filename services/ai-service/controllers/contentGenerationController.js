const ContentGenerationService = require('../services/ContentGenerationService');

/**
 * POST /api/content/generate-plan
 *
 * Triggers AI content generation for the authenticated student.
 */
const generatePlan = async (req, res) => {
    try {
        const studentId = req.user.id;
        const { week_number, module_name, target_topic, step_id } = req.body;

        if (!week_number || !module_name) {
            return res.status(400).json({
                success: false,
                message: 'week_number and module_name are required'
            });
        }

        const weekNumber = parseInt(week_number);
        const stepId = parseInt(step_id) || 1;

        console.log(`[ContentGen] Generating plan for student ${studentId}, week ${weekNumber}, module: ${module_name}`);

        const result = await ContentGenerationService.generateAndSavePlan(
            studentId,
            weekNumber,
            module_name,
            target_topic || null,
            stepId
        );

        return res.status(201).json({
            success: true,
            message: `Study plan generated successfully for Week ${weekNumber}`,
            data: {
                planId: result.planId,
                weekNumber: result.weekNumber,
                moduleName: result.moduleName,
                stepsCreated: result.stepsCreated,
                rowsInserted: result.rowsInserted
            }
        });

    } catch (error) {
        console.error('[ContentGen] Generate plan error:', error.message);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate study plan'
        });
    }
};

/**
 * GET /api/content/status
 *
 * Returns whether the authenticated student already has a study plan.
 */
const getPlanStatus = async (req, res) => {
    try {
        const studentId = req.user.id;
        const status = await ContentGenerationService.hasPlan(studentId);

        return res.json({
            success: true,
            studentId,
            ...status
        });

    } catch (error) {
        console.error('[ContentGen] Status check error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to check plan status'
        });
    }
};

/**
 * POST /api/content/regenerate-step
 * 
 * Manually trigger AI content generation for a specific existing step.
 */
const regenerateStep = async (req, res) => {
    try {
        const studentId = req.user.id;
        const { week_number, step_id, plan_id } = req.body;

        if (!week_number || !step_id || !plan_id) {
            return res.status(400).json({
                success: false,
                message: 'week_number, step_id, and plan_id are required'
            });
        }

        console.log(`[ContentGen] Regenerating content for student ${studentId}, week ${week_number}, step ${step_id}`);

        await ContentGenerationService.fillStepContent(
            studentId,
            parseInt(week_number),
            parseInt(step_id),
            parseInt(plan_id)
        );

        return res.json({
            success: true,
            message: `Content successfully regenerated for Week ${week_number}, Step ${step_id}`
        });

    } catch (error) {
        console.error('[ContentGen] Regenerate step error:', error.message);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to regenerate content'
        });
    }
};

/**
 * POST /api/content/fill-plan
 *
 * Internal endpoint triggered by study-plan-service to generate content for all steps asynchronously.
 */
const fillPlan = async (req, res) => {
    try {
        const { studentId, planId } = req.body;

        if (!studentId || !planId) {
            return res.status(400).json({
                success: false,
                message: 'studentId and planId are required'
            });
        }

        console.log(`[ContentGen] Starting background fillPlanContent for student ${studentId}, plan ${planId}...`);

        // Trigger background processing asynchronously (fire-and-forget)
        ContentGenerationService.fillPlanContent(studentId, planId)
            .then(result => {
                console.log(`[Background Content Fill] Completed successfully for student ${studentId}: ${result.stepsFilled} steps filled.`);
            })
            .catch(err => {
                console.error(`[Background Content Fill] ❌ Failed for student ${studentId}:`, err.message || err);
            });

        // Respond immediately to prevent HTTP timeout
        return res.json({
            success: true,
            message: 'Background content generation triggered successfully'
        });

    } catch (error) {
        console.error('[ContentGen] fill-plan error:', error.message);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to trigger background content generation'
        });
    }
};

module.exports = { generatePlan, getPlanStatus, regenerateStep, fillPlan };
