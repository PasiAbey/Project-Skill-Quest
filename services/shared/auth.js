const jwt = require('jsonwebtoken');

/**
 * Authentication Middleware
 * Verifies the JWT token from the 'Authorization' header statelessly.
 */
const auth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        // 1. Check for token presence
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }

        // 2. Extract and verify token
        const token = authHeader.split(' ')[1];
        const secret = process.env.JWT_SECRET || 'supersecretjwtkey';
        const decoded = jwt.verify(token, secret);

        // 3. Attach user info to request object
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
};

module.exports = auth;
