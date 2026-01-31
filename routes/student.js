const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Notice = require('../models/Notice'); // ✅ Notices model import karein
const Admin = require('../models/Admin');   // ✅ Admin model settings ke liye
const { protect } = require('../middleware/authMiddleware');

// ---------------------------------------------------------
// 1. DASHBOARD STATUS (Frontend calls /student/my-status)
// ---------------------------------------------------------
router.get('/my-status', protect, async (req, res) => {
    try {
        // Logged-in student ko dhoondna aur uske admin ki details nikalna
        const profile = await Student.findOne({ user: req.user.id }).populate('admin', 'tuitionName');
        
        if (!profile) {
            return res.status(404).json({ message: "Student profile nahi mili" });
        }

        // Attendance records nikalna (Sirf is student ke liye)
        const attendanceRecords = await Attendance.find({
            "records.student": profile._id,
            "records.status": "Present" // Sirf present days ginte hain
        });

        // Response waisa hi bhej rahe hain jaisa frontend maang raha hai
        res.json({ 
            profile, 
            tuitionName: profile.admin ? profile.admin.tuitionName : "Academy",
            attendanceCount: attendanceRecords.length,
            feesHistory: profile.fees || [] // Student model mein fees field honi chahiye
        });
    } catch (err) {
        res.status(500).json({ message: "Dashboard error", error: err.message });
    }
});

// ---------------------------------------------------------
// 2. NOTICES (Frontend calls /student/notices)
// ---------------------------------------------------------
router.get('/notices', protect, async (req, res) => {
    try {
        const student = await Student.findOne({ user: req.user.id });
        if (!student) return res.status(404).json({ message: "Student not found" });

        // Sirf wahi notices dikhana jo is student ke admin (teacher) ne daali hain
        const notices = await Notice.find({ admin: student.admin }).sort({ date: -1 }).limit(10);
        res.json(notices);
    } catch (err) {
        res.status(500).json({ message: "Notices fetch error" });
    }
});

// ---------------------------------------------------------
// 3. PROFILE DETAILS (Purana route)
// ---------------------------------------------------------
router.get('/profile', protect, async (req, res) => {
    try {
        const profile = await Student.findOne({ user: req.user.id }).populate('admin', 'tuitionName');
        if (!profile) return res.status(404).json({ message: "Profile not found" });

        const attendanceRecords = await Attendance.find({ "records.student": profile._id });

        res.json({ 
            profile, 
            tuitionName: profile.admin ? profile.admin.tuitionName : "Academy",
            attendanceCount: attendanceRecords.length,
            attendanceHistory: attendanceRecords 
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;
