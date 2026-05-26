const { pool } = require('shared');

const logExit = async (req, res) => {
    try {
        let studentId, timestamp;

        // Handle different content types from sendBeacon
        if (typeof req.body === 'string') {
            try {
                const parsed = JSON.parse(req.body);
                studentId = parsed.student_ID || parsed.studentId;
                timestamp = parsed.timestamp;
            } catch (e) {
                console.error('Failed to parse text body:', e);
                return res.status(400).json({
                    success: false,
                    message: 'Invalid request body format'
                });
            }
        } else if (req.body && typeof req.body === 'object') {
            studentId = req.body.student_ID || req.body.studentId;
            timestamp = req.body.timestamp;
        } else {
            return res.status(400).json({
                success: false,
                message: 'No request body provided'
            });
        }

        if (!studentId) {
            return res.status(400).json({
                success: false,
                message: 'Student ID is required'
            });
        }

        // Verify student exists
        const [studentCheck] = await pool.execute(
            'SELECT student_ID FROM student WHERE student_ID = ?',
            [studentId]
        );
        if (studentCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        // Use provided timestamp or current server time
        let closedAt;
        if (timestamp) {
            closedAt = new Date(timestamp).toISOString().slice(0, 19).replace('T', ' ');
        } else {
            closedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
        }

        // Update closed_at timestamp
        await pool.execute(
            'UPDATE student SET closed_at = ? WHERE student_ID = ?',
            [closedAt, studentId]
        );

        res.json({
            success: true,
            message: 'Exit logged successfully'
        });
    } catch (error) {
        console.error('Log exit error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

module.exports = { logExit };
