const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/emailHelper'); // OTP bhejne ke liye

// 🔐 SECURITY KEY (Ise kisi ko mat batana, sirf aap teachers ko denge)
const ADMIN_SECURITY_KEY = "EDUSPARK_PRO_2026"; 

// 1. ADMIN REGISTRATION (With Security Key & Tuition Name)
router.post('/admin-signup', async (req, res) => {
    const { email, password, tuitionName, securityKey } = req.body;
    
    try {
        // ✅ Rule 1: Check Security Key
        if (securityKey !== ADMIN_SECURITY_KEY) {
            return res.status(401).json({ message: "Invalid Security Key. Access Denied!" });
        }

        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: "Admin already exists" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({
            email,
            password: hashedPassword,
            role: 'ADMIN',
            tuitionName // ✅ Brand name save ho raha hai
        });

        await user.save();
        res.status(201).json({ message: "Admin registered successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. FORGOT PASSWORD (OTP Generate & Send)
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        // 4-digit OTP generate karein
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        
        // Save OTP & Expiry (10 mins) in DB
        user.resetOTP = otp;
        user.otpExpires = Date.now() + 600000; 
        await user.save();

        // Email bhejein
        await sendEmail(email, "Password Reset OTP", `Your OTP for EduSpark is: ${otp}`);

        res.json({ message: "OTP sent to your email" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. RESET PASSWORD (Verify OTP & Update)
router.post('/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;
    try {
        const user = await User.findOne({ 
            email, 
            resetOTP: otp, 
            otpExpires: { $gt: Date.now() } 
        });

        if (!user) return res.status(400).json({ message: "Invalid or expired OTP" });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetOTP = undefined; // Use hone ke baad reset karein
        user.otpExpires = undefined;
        await user.save();

        res.json({ message: "Password updated successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. LOGIN ROUTE (Same as before but with tuitionName check)
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "User not found" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

        const token = jwt.sign(
            { id: user._id, role: user.role }, 
            process.env.JWT_SECRET, 
            { expiresIn: '30d' }
        );

        res.json({ 
            token, 
            role: user.role, 
            userId: user._id,
            tuitionName: user.tuitionName || "" 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;