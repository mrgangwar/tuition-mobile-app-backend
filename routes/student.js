const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const { protect } = require('../middleware/authMiddleware');

// @route    GET /api/student/profile
// @desc     Student apna data aur attendance dekh sake
router.get('/profile', protect, async (req, res) => {
    try {
        // 1. Logged-in user ki student profile dhoondna
        const profile = await Student.findOne({ user: req.user.id });
        
        if (!profile) {
            return res.status(404).json({ message: "Student profile nahi mili" });
        }

        // 2. Us student ki attendance history nikalna
        // Hum sirf wahi records nikal rahe hain jahan is student ka ID match kare
        const attendanceRecords = await Attendance.find({
            "records.student": profile._id
        }).select('date records.$');

        res.json({ 
            profile, 
            attendanceCount: attendanceRecords.length,
            attendanceHistory: attendanceRecords 
        });
    } catch (err) {
        res.status(500).json({ message: "Data fetch karne mein error", error: err.message });
    }
});



module.exports = router;