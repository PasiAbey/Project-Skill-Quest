const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// ==========================================
// SKILLQUEST QUIZ & PROFILE SERVICE SERVER
// ==========================================
// This is the standalone quiz microservice.
// It handles diagnostic placement quizzes, answers submission, and profile classification.

const quizRoutes = require('./routes/quiz');
const profileRoutes = require('./routes/profile');

const app = express();

// ==========================================
// MIDDLEWARE CONFIGURATION
// ==========================================

// Security headers
app.use(helmet());

// Enable CORS
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));

app.use(express.json());

// ==========================================
// API ROUTES
// ==========================================
app.use('/api/quiz', quizRoutes);
app.use('/api/profile', profileRoutes);

// Health Check Endpoint
app.get('/api/quiz/health', (req, res) => {
    res.json({ status: 'OK', message: 'SkillQuest Quiz & Profile Service is running' });
});

// ==========================================
// GLOBAL ERROR HANDLING
// ==========================================
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong inside the Quiz & Profile Service!'
    });
});

// ==========================================
// SERVER START
// ==========================================
const PORT = process.env.PORT || 5002;

app.listen(PORT, () => {
    console.log(`🚀 Quiz & Profile Service running on port ${PORT}`);
});
