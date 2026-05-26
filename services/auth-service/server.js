const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// ==========================================
// SKILLQUEST AUTH SERVICE SERVER
// ==========================================
// This is the standalone auth microservice.
// It handles authentication, registration, password resets, and account settings.

const registrationRoutes = require('./routes/registration');
const loginRoutes = require('./routes/login');
const emailRoutes = require('./routes/email');
const accountRoutes = require('./routes/account');
const sessionRoutes = require('./routes/session');

const app = express();

// ==========================================
// MIDDLEWARE CONFIGURATION
// ==========================================

// Security headers (clickjacking, XSS, MIME sniffing protection)
app.use(helmet());

// Rate limiting — prevent brute-force attacks on login/register
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15-minute window
    max: 10,                   // 10 attempts per window
    message: { success: false, message: 'Too many attempts. Please try again after 15 minutes.' }
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Enable CORS for frontend and cross-service communication
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));

app.use(express.json()); // Parse JSON bodies
app.use(express.text({ type: 'text/plain' })); // Support text/plain for sendBeacon (log-exit)

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

// Serve profile uploads locally from this container if requested
app.use('/uploads', express.static('uploads'));

// ==========================================
// API ROUTES
// ==========================================
app.use('/api/auth', registrationRoutes);
app.use('/api/auth', loginRoutes);
app.use('/api/auth', emailRoutes);
app.use('/api/auth', accountRoutes);
app.use('/api/auth', sessionRoutes);

// Health Check Endpoint
app.get('/api/auth/health', (req, res) => {
    res.json({ status: 'OK', message: 'SkillQuest Auth Service is running' });
});

// ==========================================
// GLOBAL ERROR HANDLING
// ==========================================
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong inside the Auth Service!'
    });
});

// ==========================================
// SERVER START
// ==========================================
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
    console.log(`🚀 Auth Service running on port ${PORT}`);
});
