const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// ==========================================
// SKILLQUEST AI CONTENT SERVICE
// ==========================================
// Listens on port 5005. Handles deep learning content generation, lesson readings,
// personalized assessment generation, and background study roadmap hydration.

const contentGenerationRoutes = require('./routes/contentGeneration');

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
app.use('/api/content', contentGenerationRoutes);

// Health Check Endpoint
app.get('/api/content/health', (req, res) => {
    res.json({ status: 'OK', message: 'SkillQuest AI Content Service is running' });
});

// ==========================================
// GLOBAL ERROR HANDLING
// ==========================================
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong inside the AI Content Service!'
    });
});

// ==========================================
// SERVER START
// ==========================================
const PORT = process.env.PORT || 5005;

app.listen(PORT, () => {
    console.log(`🚀 AI Content Service running on port ${PORT}`);
});
