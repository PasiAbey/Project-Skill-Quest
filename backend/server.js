const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// ==========================================
// SKILLQUEST BACKEND SERVER
// ==========================================
// This is the main entry point for the Node.js backend application.
// It sets up the Express server, middleware, and routes for the SkillQuest API.
// Features:
// - Cross-Origin Resource Sharing (CORS) for frontend communication
// - JSON and Text body parsing
// - Modular routing for different features (Auth, Quiz, Analytics, etc.)

// ==========================================
// IMPORT ROUTES (Organized by Functional Requirement)
// ==========================================

// FR1: User Onboarding & Authentication
const registrationRoutes = require('./routes/registration');   // P1-P5
const loginRoutes = require('./routes/login');                 // P6-P8
const emailRoutes = require('./routes/email');                 // P5 (verification/reset)
const accountRoutes = require('./routes/account');             // Account management
const sessionRoutes = require('./routes/session');             // P19-P20

// FR2: Profile Assessment & Classification
const quizRoutes = require('./routes/quiz');                   // P9-P10
const profileRoutes = require('./routes/profile');             // P11-P12

// FR3: Adaptive Training & Execution
const trainingPlanRoutes = require('./routes/trainingPlan');   // P13
const trainingSessionRoutes = require('./routes/trainingSession'); // P14-P17

// FR4: Analytics & Session Management
const analyticsRoutes = require('./routes/analytics');         // P18
const gamificationRoutes = require('./routes/gamification');   // Supporting
const rlRoutes = require('./routes/rl');                       // Supporting (RL)

// AI Content Generation
const contentGenerationRoutes = require('./routes/contentGeneration'); // P13: AI Content
const planGeneratorRoutes = require('./routes/planGenerator'); // External Plan Generator API

const app = express();

// ==========================================
// MIDDLEWARE CONFIGURATION
// ==========================================

// Security headers (XSS, clickjacking, MIME sniffing protection)
app.use(helmet());

// Rate limiting — prevent brute-force attacks on login/register
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15-minute window
    max: 10,                   // 10 attempts per window
    message: { success: false, message: 'Too many attempts. Please try again after 15 minutes.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173', // Allow frontend origin
    credentials: true                // Allow cookies/headers
}));

app.use(express.json()); // Parse JSON bodies
app.use(express.text({ type: 'text/plain' })); // Support text/plain for sendBeacon or simple string payloads

// Handle JSON parse errors gracefully (e.g., sendBeacon text/plain bodies)
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            success: false,
            message: 'Invalid JSON in request body'
        });
    }
    next(err);
});

app.use('/uploads', express.static('uploads')); // Serve static files from 'uploads' directory


// ==========================================
// API ROUTES
// ==========================================
// All API endpoints are prefixed with /api

// FR1: User Onboarding & Authentication (all mounted on /api/auth)
app.use('/api/auth', registrationRoutes);     // P1-P5: Registration
app.use('/api/auth', loginRoutes);            // P6-P8: Login & Session Init
app.use('/api/auth', emailRoutes);            // P5: Email Verification & Password Reset
app.use('/api/auth', accountRoutes);          // Account Management (Profile, Settings)
app.use('/api/auth', sessionRoutes);          // P19-P20: Session Management

// FR2: Profile Assessment & Classification
app.use('/api/quiz', quizRoutes);             // P9-P10: Initial Quiz
app.use('/api/profile', profileRoutes);       // P11-P12: Profile Classification

// FR3: Adaptive Training & Execution (all mounted on /api/study-plan)
app.use('/api/study-plan', trainingPlanRoutes);    // P13: Training Plan
app.use('/api/study-plan', trainingSessionRoutes); // P14-P17: Training Sessions

// FR4: Analytics & Supporting Services
app.use('/api/analytics', analyticsRoutes);   // P18: Analytics
app.use('/api/gamification', gamificationRoutes); // Supporting: Gamification
app.use('/api/rl', rlRoutes);                 // Supporting: RL Recommendations

// AI Content Generation
app.use('/api/content', contentGenerationRoutes); // P13: AI Content Generation
app.use('/api/plan-generator', planGeneratorRoutes); // External Plan Generator API

// Health Check Endpoint
// Used by monitoring services (or manual checks) to verify server status
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'SkillQuest API is running' });
});

// ==========================================
// ERROR HANDLING
// ==========================================
// Global error handler for uncaught exceptions in routes
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!'
    });
});

// ==========================================
// SERVER START
// ==========================================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
