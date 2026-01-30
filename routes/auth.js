const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 1. ADMIN REGISTRATION (Sirf shuruat mein admin banane ke liye)
router.post('/admin-signup', async (req, res) => {
    const { email, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: "Admin already exists" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({
            email,
            password: hashedPassword,
            role: 'ADMIN'
        });

        await user.save();
        res.status(201).json({ message: "Admin registered successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. LOGIN ROUTE (Dono Admin aur Student ke liye)
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

        res.json({ token, role: user.role, userId: user._id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;