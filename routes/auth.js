const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/emailHelper'); 

// 🔐 SECURITY KEY (Keep this secret)
const ADMIN_SECURITY_KEY = "EDUSPARK_PRO_2026"; 

// 1. ADMIN REGISTRATION
router.post('/admin-signup', async (req, res) => {
    const { email, password, tuitionName, securityKey } = req.body;
    
    try {
        if (securityKey !== ADMIN_SECURITY_KEY) {
            return res.status(401).json({ 
                success: false, 
                message: "Unauthorized Access: Invalid Security Key." 
            });
        }

        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ 
            success: false, 
            message: "An account with this email already exists." 
        });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({
            email,
            password: hashedPassword,
            role: 'ADMIN',
            tuitionName 
        });

        await user.save();
        res.status(201).json({ 
            success: true, 
            message: "Welcome to EduSpark! Admin account registered successfully." 
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. FORGOT PASSWORD (OTP Logic)
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email: email.toLowerCase().trim() }); 
        if (!user) return res.status(404).json({ 
            success: false, 
            message: "User not found. Please check your email address." 
        });

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        
        user.resetOTP = otp;
        user.otpExpires = Date.now() + 600000; // 10 Minutes
        await user.save();

        // 📧 Premium Email Body
        const emailBody = `
            Hello,
            
            A password reset request was made for your EduSpark account. 
            Your Verification Code (OTP) is: ${otp}
            
            This code is valid for 10 minutes. If you did not request this, please ignore this email.
            
            Best Regards,
            Team EduSpark
        `;

        await sendEmail(email, "EduSpark | Password Reset Verification", emailBody);

        res.json({ 
            success: true, 
            message: "A verification code has been sent to your registered email." 
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. RESET PASSWORD
router.post('/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;
    try {
        const user = await User.findOne({ 
            email: email.toLowerCase(), 
            resetOTP: otp, 
            otpExpires: { $gt: Date.now() } 
        });

        if (!user) return res.status(400).json({ 
            success: false, 
            message: "Invalid or expired OTP. Please try again." 
        });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetOTP = undefined; 
        user.otpExpires = undefined;
        await user.save();

        res.json({ 
            success: true, 
            message: "Success! Your password has been updated. You can now log in." 
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. LOGIN ROUTE
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ 
            success: false, 
            message: "Authentication failed. User not found." 
        });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ 
            success: false, 
            message: "Invalid credentials. Please verify your password." 
        });

        const token = jwt.sign(
            { id: user._id, role: user.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: '30d' }
        );

        res.json({ 
            success: true,
            token, 
            role: user.role, 
            userId: user._id,
            tuitionName: user.tuitionName || "EduSpark Academy",
            message: "Login successful. Welcome back!"
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
