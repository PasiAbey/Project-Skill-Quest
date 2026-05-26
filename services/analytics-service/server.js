const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// ==========================================
// SKILLQUEST ANALYTICS & GAMIFICATION SERVICE
// ==========================================
// Listens on port 5004. Handles learning velocity tracking, engagement analytics,
// level/streak gamification, and reinforcement learning agent actions.

const analyticsRoutes = require('./routes/analytics');
const gamificationRoutes = require('./routes/gamification');
const rlRoutes = require('./routes/rl');

const app = express();

// ==========================================
// MIDDLEWARE CONFIGURATION
// ==========================================

// Security headers
app.use(helmet());

// Enable CORS for frontend and cross-service communication
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));

app.use(express.json()); // Parse JSON bodies

// Handle JSON parse errors gracefully
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            success: false,
            message: 'Invalid JSON in request body'
        });
    }
    next(err);
});

// ==========================================
// API ROUTES
// ==========================================
app.use('/api/analytics', analyticsRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/rl', rlRoutes);

// Health Check Endpoint
app.get('/api/analytics/health', (req, res) => {
    res.json({ status: 'OK', message: 'SkillQuest Analytics Service is running' });
});

// ==========================================
// GLOBAL ERROR HANDLING
// ==========================================
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong inside the Analytics Service!'
    });
});

// ==========================================
// SERVER START
// ==========================================
const PORT = process.env.PORT || 5004;

app.listen(PORT, () => {
    console.log(`🚀 Analytics Service running on port ${PORT}`);
});
