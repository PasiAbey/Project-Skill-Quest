const { pool } = require('shared');

// Weights for each difficulty level
const DIFFICULTY_WEIGHTS = { easy: 1, medium: 2, hard: 3 };

// Max possible weighted score based on 20-question quiz distribution
const MAX_WEIGHTED_SCORE = 38;

// Classification thresholds (percentage)
const THRESHOLDS = { advanced: 70, intermediate: 45 };

/**
 * Calculate the weighted score from 9 difficulty-breakdown scores
 */
const calculateWeightedScore = (scores) => {
    const easyTotal = (scores.at_tol_easy || 0) + (scores.ct_tol_easy || 0) + (scores.p_tol_easy || 0);
    const medTotal = (scores.at_tol_med || 0) + (scores.ct_tol_med || 0) + (scores.p_tol_med || 0);
    const hardTotal = (scores.at_tol_hard || 0) + (scores.ct_tol_hard || 0) + (scores.p_tol_hard || 0);

    return (easyTotal * DIFFICULTY_WEIGHTS.easy) +
        (medTotal * DIFFICULTY_WEIGHTS.medium) +
        (hardTotal * DIFFICULTY_WEIGHTS.hard);
};

/**
 * Determine the student's level from a weighted percentage
 */
const determineLevel = (weightedPercent) => {
    if (weightedPercent > THRESHOLDS.advanced) return 'advanced';
    if (weightedPercent > THRESHOLDS.intermediate) return 'intermediate';
    return 'beginner';
};

/**
 * P10 + P11: Classify a student based on their quiz scores
 */
const classifyStudent = async (studentId) => {
    // Fetch the student's difficulty-breakdown scores
    const [rows] = await pool.execute(
        `SELECT at_tol_easy, at_tol_med, at_tol_hard,
                ct_tol_easy, ct_tol_med, ct_tol_hard,
                p_tol_easy, p_tol_med, p_tol_hard,
                at_score, ct_score, p_score
         FROM student WHERE student_ID = ?`,
        [studentId]
    );

    if (rows.length === 0) {
        throw new Error('Student not found');
    }

    const scores = rows[0];

    // Calculate weighted score and percentage
    const weightedScore = calculateWeightedScore(scores);
    const weightedPercent = Math.round((weightedScore / MAX_WEIGHTED_SCORE) * 100);

    // Determine level
    const level = determineLevel(weightedPercent);

    // Update the student's level in the database
    await pool.execute(
        'UPDATE student SET level = ? WHERE student_ID = ?',
        [level, studentId]
    );

    return {
        level,
        weightedScore,
        weightedPercent,
        totalScore: (scores.at_score || 0) + (scores.ct_score || 0) + (scores.p_score || 0),
        scores: {
            at_score: scores.at_score || 0,
            ct_score: scores.ct_score || 0,
            p_score: scores.p_score || 0
        }
    };
};

/**
 * Get a student's existing classification without re-classifying
 */
const getClassification = async (studentId) => {
    const [rows] = await pool.execute(
        `SELECT level, at_score, ct_score, p_score,
                at_tol_easy, at_tol_med, at_tol_hard,
                ct_tol_easy, ct_tol_med, ct_tol_hard,
                p_tol_easy, p_tol_med, p_tol_hard
         FROM student WHERE student_ID = ?`,
        [studentId]
    );

    if (rows.length === 0) {
        throw new Error('Student not found');
    }

    const student = rows[0];
    const weightedScore = calculateWeightedScore(student);
    const weightedPercent = Math.round((weightedScore / MAX_WEIGHTED_SCORE) * 100);

    return {
        level: student.level || 'beginner',
        weightedScore,
        weightedPercent,
        totalScore: (student.at_score || 0) + (student.ct_score || 0) + (student.p_score || 0),
        scores: {
            at_score: student.at_score || 0,
            ct_score: student.ct_score || 0,
            p_score: student.p_score || 0
        }
    };
};

module.exports = { classifyStudent, getClassification, calculateWeightedScore, determineLevel };
