const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // Graceful fallback for local development if SMTP is not configured
    if (!process.env.SMTP_HOST) {
        console.log('\n==================================================');
        console.log(`📧 [LOCAL SMTP MOCK] Email Sent Successfully!`);
        console.log(`   To:      ${options.email}`);
        console.log(`   Subject: ${options.subject}`);
        console.log(`   Message Details:`);
        console.log(options.message.replace(/<[^>]*>/g, ' ').trim().replace(/\s+/g, ' '));
        console.log('==================================================\n');
        return;
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    // Define email options
    const mailOptions = {
        from: `${process.env.FROM_NAME || 'SkillQuest'} <${process.env.SMTP_USER}>`,
        to: options.email,
        subject: options.subject,
        html: options.message
    };

    // Send email
    await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
