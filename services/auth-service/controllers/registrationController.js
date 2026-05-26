const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, sendEmail } = require('shared');
const crypto = require('crypto');

const register = async (req, res) => {
    try {
        // ─── P1: Submit Registration Form ───
        const { email, password, firstName, lastName, userName } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        if (!firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: 'Please provide first name and last name'
            });
        }

        // ─── P2: Validate Registration Form Data ───
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters with uppercase, lowercase, number, and symbol'
            });
        }

        // ─── P3: Check for Email Existence ───
        const [existingEmail] = await pool.execute(
            'SELECT student_ID FROM student WHERE email = ?',
            [email]
        );

        if (existingEmail.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Check if username already exists
        if (userName) {
            const [existingUsername] = await pool.execute(
                'SELECT student_ID FROM student WHERE username = ?',
                [userName]
            );

            if (existingUsername.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Username already taken'
                });
            }
        }

        // ─── P4: Create User Account ───
        const [lastStudent] = await pool.execute(
            'SELECT student_ID FROM student ORDER BY student_ID DESC LIMIT 1'
        );

        let studentId;
        if (lastStudent.length > 0 && lastStudent[0].student_ID) {
            const lastId = lastStudent[0].student_ID;
            const numPart = parseInt(lastId.replace(/\D/g, '')) || 0;
            studentId = 'S' + String(numPart + 1).padStart(4, '0');
        } else {
            studentId = 'S0001';
        }

        studentId = studentId.substring(0, 10);
        const fullName = `${firstName} ${lastName}`;

        // Generate verification token for P5
        const verificationToken = crypto.randomBytes(20).toString('hex');
        const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Insert student
        await pool.execute(
            `INSERT INTO student (student_ID, name, email, username, password, status, level, at_score, p_score, ct_score, 
        ct_tol_easy, ct_tol_med, ct_tol_hard, at_tol_easy, at_tol_med, at_tol_hard, 
        p_tol_easy, p_tol_med, p_tol_hard, is_verified, verification_token, verification_token_expires) 
       VALUES (?, ?, ?, ?, ?, 0, 'beginner', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ?, ?)`,
            [studentId, fullName, email, userName || '', passwordHash, verificationToken, verificationTokenExpires]
        );

        // ─── P5: Send Account Confirmation Email ───
        try {
            const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;
            const message = `
                <h1>Email Verification</h1>
                <p>Please click the link below to verify your email address:</p>
                <a href="${verificationUrl}" clicktracking=off>${verificationUrl}</a>
            `;

            await sendEmail({
                email: email,
                subject: 'SkillQuest Email Verification',
                message
            });
        } catch (error) {
            console.error('Email sending failed:', error);
        }

        // Create JWT token
        const secret = process.env.JWT_SECRET || 'supersecretjwtkey';
        const token = jwt.sign(
            { id: studentId, email: email },
            secret,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            success: true,
            message: 'Check your email to activate your account.',
            token,
            user: {
                id: studentId,
                email: email,
                name: fullName,
                userName: userName,
                level: 'beginner',
                status: 0
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
};

module.exports = { register };
