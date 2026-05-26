const { pool } = require('shared');

/**
 * Helper function to parse options from various formats
 */
const parseOptions = (optionText) => {
    let options = [];
    const text = optionText || '';

    try {
        options = JSON.parse(text);
    } catch (e) {
        if (text.match(/[a-d]\)/i)) {
            const parts = text.split(/(?:^|\s)[a-d]\)/i);
            options = parts.map(opt => opt.trim()).filter(opt => opt.length > 0);
        } else {
            options = text.split(/[,|;]/).map(opt => opt.trim()).filter(opt => opt);
        }
    }

    if (options.length === 0 && text) {
        options = [text];
    }

    return options;
};

/**
 * Get balanced initial diagnostic quiz (20 questions)
 * Distribution:
 * - Analytical Thinking (7): 3 Easy, 2 Moderate, 2 Hard
 * - Computational Thinking (7): 3 Easy, 2 Moderate, 2 Hard
 * - Programming (6): 2 Easy, 2 Moderate, 2 Hard
 */
const getInitialQuiz = async (req, res) => {
    try {
        const userId = req.user.id;

        // Verify user exists
        const [userCheck] = await pool.execute(
            'SELECT student_ID FROM student WHERE student_ID = ?',
            [userId]
        );
        if (userCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        // Check if user already has an active or completed quiz paper
        const [existingPapers] = await pool.execute(
            'SELECT DISTINCT paper_ID FROM initial_question_paper WHERE student_ID = ? ORDER BY paper_ID DESC LIMIT 1',
            [userId]
        );

        let paperId;
        let questionsData = [];

        if (existingPapers.length > 0) {
            // Resume existing paper
            paperId = existingPapers[0].paper_ID;

            // Fetch existing questions
            const [existingQuestions] = await pool.execute(
                `SELECT iqp.q_ID, qb.question, qb.option_text, qb.correct_answer, qb.category, qb.difficulty_rate, iqp.response
                 FROM initial_question_paper iqp
                 JOIN quiz_bank qb ON iqp.q_ID = qb.q_ID
                 WHERE iqp.paper_ID = ? AND iqp.student_ID = ?`,
                [paperId, userId]
            );
            questionsData = existingQuestions;
        } else {
            // Create new paper with sequential ID
            const [maxIdResult] = await pool.execute('SELECT MAX(paper_ID) as maxId FROM initial_question_paper');
            const nextId = (maxIdResult[0].maxId || 0) + 1;
            paperId = nextId;

            // Define the balanced distribution (Total: 20 questions)
            const distribution = [
                { category: 'Analytical Thinking', difficulty: 'Easy', count: 3 },
                { category: 'Analytical Thinking', difficulty: 'Moderate', count: 2 },
                { category: 'Analytical Thinking', difficulty: 'Hard', count: 2 },
                { category: 'Computational Thinking', difficulty: 'Easy', count: 3 },
                { category: 'Computational Thinking', difficulty: 'Moderate', count: 2 },
                { category: 'Computational Thinking', difficulty: 'Hard', count: 2 },
                { category: 'Programming', difficulty: 'Easy', count: 2 },
                { category: 'Programming', difficulty: 'Moderate', count: 2 },
                { category: 'Programming', difficulty: 'Hard', count: 2 },
            ];

            let allQuestions = [];

            // Fetch questions for each category/difficulty combination
            for (const dist of distribution) {
                const [questions] = await pool.execute(
                    `SELECT q_ID, question, option_text, correct_answer, category, difficulty_rate 
                  FROM quiz_bank 
                  WHERE category = ? AND TRIM(difficulty_rate) = ?
                  ORDER BY RAND() 
                  LIMIT ${parseInt(dist.count)}`,
                    [dist.category, dist.difficulty]
                );
                allQuestions = allQuestions.concat(questions);
            }

            if (allQuestions.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No questions found in quiz bank'
                });
            }

            // Shuffle questions
            const shuffledQuestions = allQuestions.sort(() => Math.random() - 0.5);
            questionsData = shuffledQuestions;

            // Store questions
            for (const q of shuffledQuestions) {
                await pool.execute(
                    `INSERT INTO initial_question_paper (paper_ID, q_ID, student_ID, response) 
                  VALUES (?, ?, ?, NULL)`,
                    [paperId, q.q_ID, userId]
                );
            }
        }

        // Format questions for frontend
        const formattedQuestions = questionsData.map(q => {
            const options = parseOptions(q.option_text);

            return {
                id: q.q_ID,
                category: q.category,
                difficulty: q.difficulty_rate?.trim(),
                question: q.question?.trim(),
                options: options,
                correctAnswer: q.correct_answer?.trim(),
                savedResponse: q.response || null
            };
        });

        // Verify distribution
        const categoryCounts = {
            'Analytical Thinking': formattedQuestions.filter(q => q.category === 'Analytical Thinking').length,
            'Computational Thinking': formattedQuestions.filter(q => q.category === 'Computational Thinking').length,
            'Programming': formattedQuestions.filter(q => q.category === 'Programming').length
        };

        res.json({
            success: true,
            paperId: paperId,
            totalQuestions: formattedQuestions.length,
            distribution: categoryCounts,
            questions: formattedQuestions
        });
    } catch (error) {
        console.error('Get initial quiz error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again.'
        });
    }
};

/**
 * Submit answer for a question
 */
const submitAnswer = async (req, res) => {
    try {
        const userId = req.user.id;
        const { paperId, questionId, response } = req.body;

        // Verify user exists
        const [userCheck] = await pool.execute(
            'SELECT student_ID FROM student WHERE student_ID = ?',
            [userId]
        );
        if (userCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        // Update the response in initial_question_paper
        await pool.execute(
            `UPDATE initial_question_paper 
             SET response = ? 
             WHERE paper_ID = ? AND q_ID = ? AND student_ID = ?`,
            [response, paperId, questionId, userId]
        );

        res.json({
            success: true,
            message: 'Answer saved'
        });
    } catch (error) {
        console.error('Submit answer error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again.'
        });
    }
};

/**
 * Complete the initial quiz and update user status
 */
const completeQuiz = async (req, res) => {
    try {
        const userId = req.user.id;
        const { paperId, answers } = req.body;

        // Verify user exists
        const [userCheck] = await pool.execute(
            'SELECT student_ID FROM student WHERE student_ID = ?',
            [userId]
        );
        if (userCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        // If answers array is provided, save all responses
        if (answers && Array.isArray(answers)) {
            for (const answer of answers) {
                await pool.execute(
                    `UPDATE initial_question_paper 
                     SET response = ? 
                     WHERE paper_ID = ? AND q_ID = ? AND student_ID = ?`,
                    [answer.response, paperId, answer.questionId, userId]
                );
            }
        }

        // Calculate scores
        const [results] = await pool.execute(
            `SELECT 
                iqp.response,
                qb.correct_answer,
                qb.category,
                qb.difficulty_rate
             FROM initial_question_paper iqp
             JOIN quiz_bank qb ON iqp.q_ID = qb.q_ID
             WHERE iqp.paper_ID = ? AND iqp.student_ID = ?`,
            [paperId, userId]
        );

        let at_score = 0;
        let ct_score = 0;
        let p_score = 0;

        let ct_tol_easy = 0, ct_tol_med = 0, ct_tol_hard = 0;
        let at_tol_easy = 0, at_tol_med = 0, at_tol_hard = 0;
        let p_tol_easy = 0, p_tol_med = 0, p_tol_hard = 0;

        for (const row of results) {
            const userAns = (row.response || '').trim().toLowerCase();
            const correctAns = (row.correct_answer || '').trim().toLowerCase();

            const isMatch = userAns === correctAns ||
                (userAns.length > 1 && correctAns.includes(userAns)) ||
                (correctAns.length > 1 && userAns.includes(correctAns));

            if (userAns && isMatch) {
                const diff = (row.difficulty_rate || '').trim();

                if (row.category === 'Analytical Thinking') {
                    at_score++;
                    if (diff === 'Easy') at_tol_easy++;
                    else if (diff === 'Moderate') at_tol_med++;
                    else if (diff === 'Hard') at_tol_hard++;
                } else if (row.category === 'Computational Thinking') {
                    ct_score++;
                    if (diff === 'Easy') ct_tol_easy++;
                    else if (diff === 'Moderate') ct_tol_med++;
                    else if (diff === 'Hard') ct_tol_hard++;
                } else if (row.category === 'Programming') {
                    p_score++;
                    if (diff === 'Easy') p_tol_easy++;
                    else if (diff === 'Moderate') p_tol_med++;
                    else if (diff === 'Hard') p_tol_hard++;
                }
            }
        }

        const total_score = at_score + ct_score + p_score;

        // Update student status to 1 (quiz completed) and save scores
        await pool.execute(
            `UPDATE student 
             SET status = 1, at_score = ?, ct_score = ?, p_score = ?,
                 ct_tol_easy = ?, ct_tol_med = ?, ct_tol_hard = ?,
                 at_tol_easy = ?, at_tol_med = ?, at_tol_hard = ?,
                 p_tol_easy = ?, p_tol_med = ?, p_tol_hard = ?
             WHERE student_ID = ?`,
            [at_score, ct_score, p_score,
                ct_tol_easy, ct_tol_med, ct_tol_hard,
                at_tol_easy, at_tol_med, at_tol_hard,
                p_tol_easy, p_tol_med, p_tol_hard,
                userId]
        );

        // P10: Forward quiz results to the local Profile Classifier
        const { classifyStudent } = require('../services/ProfileClassifierService');
        await classifyStudent(userId);

        // Generate the full 4-week study plan - notify study-plan-service via HTTP POST
        try {
            fetch('http://study-plan-service:5003/api/study-plan/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': req.headers.authorization // Forward verified JWT
                },
                body: JSON.stringify({ userId, weeks: 4 })
            })
            .then(async response => {
                const data = await response.json();
                if (data.success) {
                    console.log(`[QuizComplete] ✅ Study plan generated successfully: ${data.totalRowsInserted} rows.`);
                }
            })
            .catch(err => {
                console.error(`[QuizComplete] ❌ Study plan generation microservice request failed:`, err.message);
            });
        } catch (err) {
            console.error(`[QuizComplete] ❌ Asynchronous fetch setup failed:`, err.message);
        }

        // Get updated user data
        const [rows] = await pool.execute(
            'SELECT student_ID, name, email, profile_pic, status, level FROM student WHERE student_ID = ?',
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = rows[0];

        res.json({
            success: true,
            message: 'Quiz completed successfully!',
            results: {
                at_score,
                ct_score,
                p_score,
                total_score
            },
            planGenerated: true,
            user: {
                id: user.student_ID,
                email: user.email,
                name: user.name,
                level: user.level,
                status: user.status,
                profilePic: user.profile_pic
            }
        });
    } catch (error) {
        console.error('Complete quiz error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again.'
        });
    }
};

module.exports = { getInitialQuiz, submitAnswer, completeQuiz };
