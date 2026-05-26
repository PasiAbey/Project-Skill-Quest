const bcrypt = require('bcryptjs');
const { pool, sendEmail } = require('shared');
const crypto = require('crypto');

const verifyEmail = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Invalid verification token'
            });
        }

        // Find user with matching token and not expired
        const [rows] = await pool.execute(
            'SELECT student_ID FROM student WHERE verification_token = ? AND verification_token_expires > NOW()',
            [token]
        );

        if (rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification token'
            });
        }

        const student = rows[0];

        // Update user to verified and clear token
        await pool.execute(
            'UPDATE student SET is_verified = 1, verification_token = NULL, verification_token_expires = NULL WHERE student_ID = ?',
            [student.student_ID]
        );

        res.json({
            success: true,
            message: 'Email verified successfully. You can now login.'
        });

    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

const resendVerification = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an email address'
            });
        }

        // Check user exists
        const [rows] = await pool.execute(
            'SELECT student_ID, is_verified, name FROM student WHERE email = ?',
            [email]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const student = rows[0];

        if (student.is_verified) {
            return res.status(400).json({
                success: false,
                message: 'Account already verified. Please login.'
            });
        }

        // Generate new token
        const verificationToken = crypto.randomBytes(20).toString('hex');
        const verificationTokenExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

        // Update database
        await pool.execute(
            'UPDATE student SET verification_token = ?, verification_token_expires = ? WHERE student_ID = ?',
            [verificationToken, verificationTokenExpires, student.student_ID]
        );

        // Send email
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
        const message = `
            <h1>Email Verification</h1>
            <p>Hi ${student.name},</p>
            <p>Please click the link below to verify your account:</p>
            <a href="${verificationUrl}" clicktracking=off>${verificationUrl}</a>
            <p>This link will expire in 10 minutes.</p>
        `;

        await sendEmail({
            email: email,
            subject: 'Resend: SkillQuest Email Verification',
            message
        });

        res.json({
            success: true,
            message: 'Verification email resent. Please check your inbox.'
        });

    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Please provide an email address' });
        }

        const [rows] = await pool.execute('SELECT student_ID, name FROM student WHERE email = ?', [email]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const student = rows[0];
        const resetToken = crypto.randomBytes(20).toString('hex');
        const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '); // 1 hour

        await pool.execute(
            'UPDATE student SET reset_password_token = ?, reset_password_expires = ? WHERE student_ID = ?',
            [resetToken, resetTokenExpires, student.student_ID]
        );

        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
        const message = `
            <h1>Password Reset Request</h1>
            <p>Hi ${student.name},</p>
            <p>You requested a password reset. Please click the link below to set a new password:</p>
            <a href="${resetUrl}" clicktracking=off>${resetUrl}</a>
            <p>This link will expire in 1 hour.</p>
        `;

        await sendEmail({
            email: email,
            subject: 'SkillQuest Password Reset',
            message
        });

        res.json({ success: true, message: 'Password reset email sent.' });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ success: false, message: 'Please provide a new password' });
        }

        const [rows] = await pool.execute(
            'SELECT student_ID FROM student WHERE reset_password_token = ? AND reset_password_expires > NOW()',
            [token]
        );

        if (rows.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid or expired token' });
        }

        const student = rows[0];
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await pool.execute(
            'UPDATE student SET password = ?, reset_password_token = NULL, reset_password_expires = NULL WHERE student_ID = ?',
            [hashedPassword, student.student_ID]
        );

        res.json({ success: true, message: 'Password reset successful. You can now login.' });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const verifyEmailChange = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Invalid verification token'
            });
        }

        // Find user with matching token, not expired, and has a pending email
        const [rows] = await pool.execute(
            'SELECT student_ID, pending_email FROM student WHERE verification_token = ? AND verification_token_expires > NOW() AND pending_email IS NOT NULL',
            [token]
        );

        if (rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification token'
            });
        }

        const student = rows[0];

        // Check that the pending email isn't already taken by someone else
        const [existingEmail] = await pool.execute(
            'SELECT student_ID FROM student WHERE email = ? AND student_ID != ?',
            [student.pending_email, student.student_ID]
        );

        if (existingEmail.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'This email is already registered to another account'
            });
        }

        // Update email to the verified pending email and clear all verification fields
        await pool.execute(
            'UPDATE student SET email = ?, pending_email = NULL, verification_token = NULL, verification_token_expires = NULL WHERE student_ID = ?',
            [student.pending_email, student.student_ID]
        );

        res.json({
            success: true,
            message: 'Email updated successfully! Please log in with your new email.'
        });

    } catch (error) {
        console.error('Verify email change error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

module.exports = { verifyEmail, resendVerification, forgotPassword, resetPassword, verifyEmailChange };
