const { pool } = require('shared');

/**
 * Get Step Content (P14, P15)
 */
const getStepContent = async (req, res) => {
    try {
        const studentId = req.user.id;
        const weekNumber = parseInt(req.params.weekNumber);
        const stepId = parseInt(req.params.stepId);
        const recommendationId = req.query.recId || null;

        const [rows] = await pool.execute(
            `SELECT 
                plan_id,
                step_ID,
                module_name,
                gen_QID,
                learning_content,
                question,
                options,
                correct_answer,
                step_status,
                attempt_count,
                user_response
             FROM study_plan 
             WHERE student_ID = ? 
             AND week_number = ? 
             AND step_ID = ?
             AND plan_id = (SELECT MAX(plan_id) FROM study_plan WHERE student_ID = ?)
             ORDER BY gen_QID`,
            [studentId, weekNumber, stepId, studentId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Step not found'
            });
        }

        const questions = rows.map(row => ({
            genQID: row.gen_QID,
            question: row.question,
            options: row.options,
            correctAnswer: row.correct_answer,
            savedResponse: row.user_response || null
        }));

        res.json({
            success: true,
            planId: rows[0].plan_id,
            weekNumber: weekNumber,
            stepId: stepId,
            moduleName: rows[0].module_name,
            learningContent: rows[0].learning_content,
            stepStatus: rows[0].step_status,
            attemptCount: rows[0].attempt_count,
            questions: questions
        });

        // ─── P16: Monitor and Record Performance Data (Trigger RL Feedback) ───
        if (recommendationId) {
            fetch('http://analytics-service:5004/api/rl/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: studentId, engaged: true, recommendationId })
            })
            .then(async r => {
                const data = await r.json();
                if (data.success) console.log(`✅ RL FEEDBACK SENT for student ${studentId} (RecID: ${recommendationId})`);
            })
            .catch(err => console.error('⚠️ RL Feedback Error:', err.message));
        }

    } catch (error) {
        console.error('Get step content error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch step content'
        });
    }
};

/**
 * Submit Step Quiz (P15, P16, P17)
 */
const submitStepQuiz = async (req, res) => {
    try {
        const studentId = req.user.id;
        const { planId, weekNumber, stepId, startTime, answers } = req.body;

        if (!planId) {
            return res.status(400).json({
                success: false,
                message: 'Missing planId in submission'
            });
        }

        if (!answers || !Array.isArray(answers) || answers.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No answers provided'
            });
        }

        const [questions] = await pool.execute(
            `SELECT gen_QID, correct_answer, attempt_count, question 
             FROM study_plan 
             WHERE student_ID = ? AND week_number = ? AND step_ID = ?`,
            [studentId, weekNumber, stepId]
        );

        if (questions.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Step not found'
            });
        }

        const [attemptRows] = await pool.execute(
            `SELECT MAX(attempt_number) as maxAttempt 
             FROM quiz_attempts 
             WHERE student_ID = ? AND week_number = ? AND step_ID = ?`,
            [studentId, weekNumber, stepId]
        );
        const currentAttempt = (attemptRows[0].maxAttempt || 0) + 1;

        const correctAnswersMap = {};
        const questionsMap = {};
        questions.forEach(q => {
            correctAnswersMap[q.gen_QID] = q.correct_answer;
            questionsMap[q.gen_QID] = q.question;
        });

        let allCorrect = true;
        let score = 0;
        const wrongAnswersSummary = [];

        const finishTime = new Date();
        const finishedAt = finishTime.toISOString().slice(0, 19).replace('T', ' ');

        let attemptedAt;
        if (startTime) {
            attemptedAt = new Date(startTime).toISOString().slice(0, 19).replace('T', ' ');
        } else {
            attemptedAt = finishedAt;
        }

        // Process each answer
        for (const answer of answers) {
            const correctAnswer = correctAnswersMap[answer.genQID];
            const isCorrect = answer.response === correctAnswer;

            if (isCorrect) score++;
            else {
                allCorrect = false;
                wrongAnswersSummary.push({
                    questionId: answer.genQID,
                    question: questionsMap[answer.genQID],
                    userAnswer: answer.response,
                    correctAnswer: correctAnswer
                });
            }

            await pool.execute(
                `INSERT INTO quiz_attempts 
                 (plan_id, week_number, step_ID, gen_QID, attempt_number, student_ID, user_response, is_correct, score, attempted_at, finished_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [planId, weekNumber, stepId, answer.genQID, currentAttempt, studentId, answer.response, isCorrect ? 1 : 0, isCorrect ? 1 : 0, attemptedAt, finishedAt]
            );
        }

        await pool.execute(
            `UPDATE study_plan 
             SET attempt_count = ? 
             WHERE student_ID = ? AND week_number = ? AND step_ID = ?`,
            [currentAttempt, studentId, weekNumber, stepId]
        );

        await pool.execute(
            `UPDATE study_plan 
             SET user_response = NULL 
             WHERE student_ID = ? AND week_number = ? AND step_ID = ?`,
            [studentId, weekNumber, stepId]
        );

        const totalQuestions = questions.length;
        const percentage = totalQuestions > 0 ? (score / totalQuestions) : 0;
        const passedStrong = percentage >= 0.8;
        const passedWithReview = percentage >= 0.4 && percentage < 0.8;
        const passed = passedStrong || passedWithReview;

        if (passed) {
            const newStatus = passedStrong ? 'COMPLETED' : 'NEEDS_REVIEW';
            
            await pool.execute(
                `UPDATE study_plan 
                 SET step_status = ?, 
                     completed_at = NOW() 
                 WHERE student_ID = ? AND week_number = ? AND step_ID = ?`,
                [newStatus, studentId, weekNumber, stepId]
            );

            const nextStepId = stepId + 1;
            await pool.execute(
                `UPDATE study_plan 
                 SET step_status = 'IN_PROGRESS' 
                 WHERE student_ID = ? AND week_number = ? AND step_ID = ? AND step_status = 'LOCKED'`,
                [studentId, weekNumber, nextStepId]
            );

            // ─── Gamification Cross-Service triggers (Asynchronous) ───
            const xpEarned = 50 + (score * 10);
            fetch('http://analytics-service:5004/api/gamification/xp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: studentId, xpAmount: xpEarned })
            }).catch(e => console.error('Gamification addXP failed:', e.message));

            fetch('http://analytics-service:5004/api/gamification/streak', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: studentId })
            }).catch(e => console.error('Gamification updateStreak failed:', e.message));
        }

        const [weekSteps] = await pool.execute(
            `SELECT 
                COUNT(DISTINCT step_ID) as total,
                COUNT(DISTINCT CASE WHEN step_status IN ('COMPLETED', 'NEEDS_REVIEW') THEN step_ID END) as completed
             FROM study_plan WHERE student_ID = ? AND week_number = ?`,
            [studentId, weekNumber]
        );

        const isWeekComplete = weekSteps[0].total > 0 && weekSteps[0].completed === weekSteps[0].total;

        let nextStepExists = false;
        const nextStepId = stepId + 1;
        if (passed && !isWeekComplete) {
            const [nextStepCheck] = await pool.execute(
                `SELECT COUNT(*) as count FROM study_plan 
                 WHERE student_ID = ? AND week_number = ? AND step_ID = ?`,
                [studentId, weekNumber, nextStepId]
            );
            nextStepExists = nextStepCheck[0].count > 0;
        }

        // ─── RL Cross-Service trigger (Asynchronous) ───
        let rlRecommendation = null;
        if (passed) {
            try {
                const rlResponse = await fetch('http://analytics-service:5004/api/rl/recommendation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: studentId })
                }).then(r => r.json());

                if (rlResponse.success && rlResponse.recommendation) {
                    const actionCode = rlResponse.recommendation.action_code;

                    if (actionCode === 'BADGE_INJECTION') {
                        // Request random badge assignment from analytics-service
                        const badgeResponse = await fetch('http://analytics-service:5004/api/rl/badge-inject', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: studentId })
                        }).then(r => r.json());

                        if (badgeResponse.success && badgeResponse.badge) {
                            rlRecommendation = {
                                action_code: 'BADGE_INJECTION',
                                badge: badgeResponse.badge
                            };
                        }
                    }
                    else if (actionCode === 'RANK_COMPARISON') {
                        const rankResponse = await fetch('http://analytics-service:5004/api/rl/rank-calc', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: studentId })
                        }).then(r => r.json());

                        if (rankResponse.success) {
                            rlRecommendation = {
                                action_code: 'RANK_COMPARISON',
                                rank_percentile: rankResponse.percentile,
                                rank_text: rankResponse.rank_text
                            };
                        }
                    }
                    else {
                        rlRecommendation = {
                            action_code: actionCode,
                            action_name: rlResponse.recommendation.action_name,
                            description: rlResponse.recommendation.description
                        };
                    }
                }
            } catch (error) {
                console.error('❌ RL microservice trigger error:', error.message);
            }
        }

        let message = '';
        if (passedStrong) {
            message = isWeekComplete 
                ? 'Congratulations! You completed this week! Return to dashboard to continue.' 
                : 'Congratulations! You passed. Next step unlocked!';
        } else if (passedWithReview) {
            message = 'You passed, but there are some areas to review. Next step unlocked!';
        } else {
            message = 'You need 80% to pass. Please review the material and try again.';
        }

        res.json({
            success: true,
            passed: passed,
            passedWithReview: passedWithReview || false,
            wrongAnswersSummary: passedWithReview ? wrongAnswersSummary : [],
            score: score,
            totalQuestions: totalQuestions,
            attemptNumber: currentAttempt,
            xpEarned: passed ? 50 + (score * 10) : 0,
            isWeekComplete: isWeekComplete && passed,
            nextStepId: nextStepExists ? nextStepId : null,
            weekNumber: weekNumber,
            rlRecommendation: rlRecommendation,
            message: message
        });

    } catch (error) {
        console.error('Submit step quiz error:', error);
        res.status(500).json({
            success: false,
            message: `Failed to submit quiz: ${error.message}`
        });
    }
};

/**
 * Save Step Response
 */
const saveStepResponse = async (req, res) => {
    try {
        const studentId = req.user.id;
        const { planId, weekNumber, stepId, genQID, response } = req.body;

        if (!planId || !genQID || !response) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: planId, genQID, response'
            });
        }

        await pool.execute(
            `UPDATE study_plan 
             SET user_response = ? 
             WHERE plan_id = ? AND student_ID = ? AND week_number = ? AND step_ID = ? AND gen_QID = ?`,
            [response, planId, studentId, weekNumber, stepId, genQID]
        );

        res.json({
            success: true,
            message: 'Response saved'
        });
    } catch (error) {
        console.error('Save step response error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save response'
        });
    }
};

/**
 * Clear Step Responses
 */
const clearStepResponses = async (req, res) => {
    try {
        const studentId = req.user.id;
        const { planId, weekNumber, stepId } = req.body;

        if (!planId || weekNumber === undefined || stepId === undefined) {
            return res.status(400).json({ success: false, message: 'Missing fields' });
        }

        await pool.execute(
            `UPDATE study_plan 
             SET user_response = NULL 
             WHERE plan_id = ? AND student_ID = ? AND week_number = ? AND step_ID = ?`,
            [planId, studentId, weekNumber, stepId]
        );

        res.json({ success: true, message: 'Responses cleared' });
    } catch (error) {
        console.error('Clear step response error:', error);
        res.status(500).json({ success: false, message: 'Failed to clear responses' });
    }
};

module.exports = { getStepContent, submitStepQuiz, saveStepResponse, clearStepResponses };
