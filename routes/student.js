const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const { protect } = require('../middleware/authMiddleware');

// @route    GET /api/student/profile
// @desc     Student apna data, attendance aur Tuition Brand dekh sake
router.get('/profile', protect, async (req, res) => {
    try {
        // 1. Logged-in student ki profile dhundna
        // ✅ .populate('user') se hum Admin (Teacher) ki information (tuitionName) nikalenge
        const profile = await Student.findOne({ user: req.user.id })
            .populate({
                path: 'admin', // Student model mein jo admin field hai use populate kiya
                select: 'tuitionName' // Sirf tuitionName uthaya, password nahi
            });
        
        if (!profile) {
            return res.status(404).json({ message: "Student profile nahi mili" });
        }

        // 2. Us student ki attendance history nikalna
        const attendanceRecords = await Attendance.find({
            "records.student": profile._id
        }).select('date records.$');

        // 3. Final Branded Response
        res.json({ 
            profile, 
            // ✅ Dashboard ko batana ki teacher ki tuition ka naam kya hai
            tuitionName: profile.admin ? profile.admin.tuitionName : "EduSpark Academy",
            attendanceCount: attendanceRecords.length,
            attendanceHistory: attendanceRecords 
        });
    } catch (err) {
        res.status(500).json({ message: "Data fetch karne mein error", error: err.message });
    }
});

module.exports = router;