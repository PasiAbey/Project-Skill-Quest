const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('shared');

const login = async (req, res) => {
    try {
        // ─── P6: Submit Login Details ───
        const { email, password, rememberMe } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        // ─── P7: Validate Login Credentials ───
        const [rows] = await pool.execute(
            'SELECT * FROM student WHERE email = ?',
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const student = rows[0];

        // Check if email is verified
        if (!student.is_verified) {
            return res.status(401).json({
                success: false,
                message: 'Please verify your email address to login.'
            });
        }

        // Check password (legacy plain text + bcrypt)
        let isMatch = false;

        if (password === student.password) {
            isMatch = true;
        } else {
            try {
                isMatch = await bcrypt.compare(password, student.password);
            } catch (e) {
                isMatch = false;
            }
        }

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Update last_login timestamp
        await pool.execute(
            'UPDATE student SET last_login = NOW() WHERE student_ID = ?',
            [student.student_ID]
        );

        // ─── P8: Redirect to Dashboard (Issue JWT Session) ───
        const tokenExpiry = rememberMe ? '30d' : '24h';
        const secret = process.env.JWT_SECRET || 'supersecretjwtkey';
        const token = jwt.sign(
            { id: student.student_ID, email: student.email },
            secret,
            { expiresIn: tokenExpiry }
        );

        // ─── Trigger Background Content Generation in AI Service ───
        // Fire-and-forget: If the student has an active plan, notify the ai-service
        // to asynchronously fill any missing study plan contents (e.g. Week 2+)
        try {
            const [planRows] = await pool.execute(
                'SELECT plan_id FROM study_plan WHERE student_ID = ? LIMIT 1',
                [student.student_ID]
            );
            if (planRows.length > 0) {
                const planId = planRows[0].plan_id;
                
                // Call external AI service microservice endpoint asynchronously using native fetch
                fetch('http://ai-service:5005/api/content/fill-plan', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` // Pass JWT for verification
                    },
                    body: JSON.stringify({ studentId: student.student_ID, planId })
                })
                .then(async response => {
                    const data = await response.json();
                    if (data.success && data.stepsFilled > 0) {
                        console.log(`[Login] Asynchronous plan generation trigger successful: ${data.stepsFilled} steps filled.`);
                    }
                })
                .catch(e => console.error('[Login] Asynchronous plan generation trigger error:', e.message));
            }
        } catch (err) {
            console.error('[Login] Failed to check for active plan for background generation:', err.message);
        }

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: student.student_ID,
                email: student.email,
                name: student.name,
                level: student.level,
                status: student.status,
                profilePic: student.profile_pic,
                bio: student.bio
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again.'
        });
    }
};

const getMe = async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT student_ID, name, email, profile_pic, status, level, at_score, p_score, ct_score, bio FROM student WHERE student_ID = ?',
            [req.user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        res.json({
            success: true,
            user: rows[0]
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

module.exports = { login, getMe };
