const bcrypt = require('bcryptjs');
const { pool, sendEmail } = require('shared');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// ==========================================
// PROFILE PICTURE UPLOAD CONFIGURATION
// ==========================================

const storage = multer.diskStorage({
    destination: './uploads/',
    filename: function (req, file, cb) {
        cb(null, 'profile-' + Date.now() + path.extname(file.originalname));
    }
});

const checkFileType = (file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb('Error: Images Only!');
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5000000 }, // 5MB limit
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    }
});

// ==========================================
// ACCOUNT INFO ENDPOINTS
// ==========================================

const getAccountInfo = async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT email, status, created_at, last_login FROM student WHERE student_ID = ?',
            [req.user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        const student = rows[0];

        // Calculate days on platform
        const createdAt = student.created_at ? new Date(student.created_at) : new Date();
        const now = new Date();
        const diffTime = Math.abs(now - createdAt);
        const daysOnPlatform = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Determine account status text
        const statusText = student.status === 1 ? 'Active' : 'Pending Quiz';

        res.json({
            success: true,
            data: {
                email: student.email,
                memberSince: createdAt.toISOString(),
                accountStatus: statusText,
                daysOnPlatform: daysOnPlatform,
                lastActive: student.last_login ? new Date(student.last_login).toISOString() : null
            }
        });
    } catch (error) {
        console.error('Get account info error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

const getPersonalBests = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get longest streak from student table
        const [streakRows] = await pool.execute(
            'SELECT longest_streak, current_streak FROM student WHERE student_ID = ?',
            [userId]
        );

        if (streakRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        const longestStreak = Math.max(
            streakRows[0].longest_streak || 0,
            streakRows[0].current_streak || 0
        );

        // Get highest quiz score (percentage)
        const [scoreRows] = await pool.execute(
            `SELECT 
                week_number, step_ID, attempt_number,
                SUM(is_correct) as correct_count,
                COUNT(*) as total_count,
                ROUND(SUM(is_correct) / COUNT(*) * 100, 0) as score_percentage
             FROM quiz_attempts 
             WHERE student_ID = ?
             GROUP BY week_number, step_ID, attempt_number
             ORDER BY score_percentage DESC
             LIMIT 1`,
            [userId]
        );

        const highestScore = scoreRows.length > 0 ? scoreRows[0].score_percentage : null;

        // Get fastest quiz completion time
        const [timeRows] = await pool.execute(
            `SELECT 
                week_number, step_ID, attempt_number,
                MIN(attempted_at) as start_time,
                MAX(finished_at) as end_time,
                TIMESTAMPDIFF(SECOND, MIN(attempted_at), MAX(finished_at)) as duration_seconds
             FROM quiz_attempts 
             WHERE student_ID = ? 
               AND attempted_at IS NOT NULL 
               AND finished_at IS NOT NULL
             GROUP BY week_number, step_ID, attempt_number
             HAVING duration_seconds > 0
             ORDER BY duration_seconds ASC
             LIMIT 1`,
            [userId]
        );

        let fastestTime = null;
        if (timeRows.length > 0 && timeRows[0].duration_seconds) {
            const seconds = timeRows[0].duration_seconds;
            if (seconds < 60) {
                fastestTime = `${seconds}s`;
            } else {
                const mins = Math.floor(seconds / 60);
                const secs = seconds % 60;
                fastestTime = secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
            }
        }

        res.json({
            success: true,
            data: {
                highestScore: highestScore !== null ? `${highestScore}%` : null,
                longestStreak: longestStreak,
                fastestTime: fastestTime
            }
        });
    } catch (error) {
        console.error('Get personal bests error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

const uploadProfilePic = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const userId = req.user.id;
        const profilePicUrl = `/uploads/${req.file.filename}`;

        await pool.execute(
            'UPDATE student SET profile_pic = ? WHERE student_ID = ?',
            [profilePicUrl, userId]
        );

        res.json({
            success: true,
            message: 'Profile picture updated',
            profilePic: profilePicUrl
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during upload'
        });
    }
};

const updateProfile = async (req, res) => {
    try {
        const { name, bio } = req.body;
        const userId = req.user.id;

        if (!name || name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Name is required'
            });
        }

        // Verify user exists
        const [userCheck] = await pool.execute(
            'SELECT student_ID FROM student WHERE student_ID = ?',
            [userId]
        );
        if (userCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        await pool.execute(
            'UPDATE student SET name = ?, bio = ? WHERE student_ID = ?',
            [name, bio || null, userId]
        );

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                name,
                bio: bio || null
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Please provide current and new password'
            });
        }

        // Validate password strength — min 8 chars, uppercase, lowercase, number, symbol
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters with uppercase, lowercase, number, and symbol'
            });
        }

        const [rows] = await pool.execute(
            'SELECT password FROM student WHERE student_ID = ?',
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const student = rows[0];

        // Check if current password matches (legacy plain text + bcrypt)
        let isMatch = false;

        if (currentPassword === student.password) {
            isMatch = true;
        } else {
            try {
                isMatch = await bcrypt.compare(currentPassword, student.password);
            } catch (e) {
                isMatch = false;
            }
        }

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Incorrect current password'
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(newPassword, salt);

        await pool.execute(
            'UPDATE student SET password = ? WHERE student_ID = ?',
            [passwordHash, userId]
        );

        res.json({
            success: true,
            message: 'Password updated successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

const changeEmail = async (req, res) => {
    try {
        const { newEmail } = req.body;
        const userId = req.user.id;

        if (!newEmail || newEmail.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid email address'
            });
        }

        // Check if email already exists
        const [existingEmail] = await pool.execute(
            'SELECT student_ID FROM student WHERE email = ? AND student_ID != ?',
            [newEmail, userId]
        );

        if (existingEmail.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'This email is already registered to another account'
            });
        }

        // Verify user exists and get their name
        const [userCheck] = await pool.execute(
            'SELECT student_ID, name, email FROM student WHERE student_ID = ?',
            [userId]
        );
        if (userCheck.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        const student = userCheck[0];

        // Check new email is different from current
        if (student.email === newEmail) {
            return res.status(400).json({
                success: false,
                message: 'New email must be different from your current email'
            });
        }

        // Generate verification token (10-minute expiry)
        const verificationToken = crypto.randomBytes(20).toString('hex');
        const verificationTokenExpires = new Date(Date.now() + 10 * 60 * 1000)
            .toISOString().slice(0, 19).replace('T', ' ');

        // Store pending email and token
        await pool.execute(
            'UPDATE student SET pending_email = ?, verification_token = ?, verification_token_expires = ? WHERE student_ID = ?',
            [newEmail, verificationToken, verificationTokenExpires, userId]
        );

        // Send verification email to the NEW email address
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}&type=email-change`;
        const message = `
            <h1>Verify Your New Email</h1>
            <p>Hi ${student.name},</p>
            <p>You requested to change your email address to <strong>${newEmail}</strong>.</p>
            <p>Please click the link below to verify this email:</p>
            <a href="${verificationUrl}" clicktracking=off>${verificationUrl}</a>
            <p>This link will expire in 10 minutes.</p>
            <p>If you didn't request this change, you can safely ignore this email.</p>
        `;

        await sendEmail({
            email: newEmail,
            subject: 'SkillQuest - Verify Your New Email Address',
            message
        });

        res.json({
            success: true,
            message: 'A verification link has been sent to your new email address. Please check your inbox to confirm the change.',
            pendingEmail: newEmail
        });
    } catch (error) {
        console.error('Change email error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

const deleteAccount = async (req, res) => {
    try {
        const userId = req.user.id;

        // Delete from child tables first
        await pool.execute('DELETE FROM quiz_attempts WHERE student_ID = ?', [userId]);
        await pool.execute('DELETE FROM study_plan WHERE student_ID = ?', [userId]);
        await pool.execute('DELETE FROM initial_question_paper WHERE student_ID = ?', [userId]);

        // Finally delete the student record
        await pool.execute('DELETE FROM student WHERE student_ID = ?', [userId]);

        res.json({
            success: true,
            message: 'Account deleted successfully'
        });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete account. Please try again.'
        });
    }
};

module.exports = { getAccountInfo, getPersonalBests, upload, uploadProfilePic, updateProfile, changePassword, changeEmail, deleteAccount };
