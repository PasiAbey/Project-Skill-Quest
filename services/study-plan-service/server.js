const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// ==========================================
// SKILLQUEST STUDY PLAN SERVICE SERVER
// ==========================================
// This is the standalone study-plan microservice.
// It handles weekly roadmap progress, learning content delivery, and interactive training sessions.

const trainingPlanRoutes = require('./routes/trainingPlan');
const trainingSessionRoutes = require('./routes/trainingSession');

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
// All study-plan related endpoints are mounted on /api/study-plan
app.use('/api/study-plan', trainingPlanRoutes);
app.use('/api/study-plan', trainingSessionRoutes);

// Health Check Endpoint
app.get('/api/study-plan/health', (req, res) => {
    res.json({ status: 'OK', message: 'SkillQuest Study Plan Service is running' });
});

// ==========================================
// GLOBAL ERROR HANDLING
// ==========================================
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong inside the Study Plan Service!'
    });
});

// ==========================================
// SERVER START
// ==========================================
const PORT = process.env.PORT || 5003;

app.listen(PORT, () => {
    console.log(`🚀 Study Plan Service running on port ${PORT}`);
});
