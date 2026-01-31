const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Notice = require('../models/Notice'); 
const Fee = require('../models/Fees'); // ✅ Fees model import kiya
const User = require('../models/User'); // ✅ Admin details ke liye User model
const { protect } = require('../middleware/authMiddleware');

// ==========================================
// ⭐ INTERNAL HELPER: FEES CALCULATION
// ==========================================
const calculateFeeDetails = async (student) => {
    // Agar joiningDate nahi hai toh createdAt use karega
    const start = new Date(student.joiningDate || student.createdAt);
    const today = new Date();
    
    // Months count: Joining se aaj tak kitne mahine hue
    let monthsElapsed = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
    monthsElapsed = monthsElapsed < 0 ? 0 : monthsElapsed + 1;

    const totalExpected = monthsElapsed * (student.feesPerMonth || 0);
    
    // Admin dwara approve ki gayi paid fees ka total
    const paidRecords = await Fee.find({ 
        student: student._id, 
        status: 'Paid'
    }).sort({ createdAt: -1 });
    
    const totalPaid = paidRecords.reduce((sum, f) => sum + f.amount, 0);
    const totalDue = totalExpected - totalPaid;

    return {
        totalDue: totalDue > 0 ? totalDue : 0,
        monthsCount: monthsElapsed,
        paidHistory: paidRecords
    };
};

// ---------------------------------------------------------
// 1. DASHBOARD STATUS (Frontend calls /student/my-status)
// ---------------------------------------------------------
router.get('/my-status', protect, async (req, res) => {
    try {
        // req.user.id se student dhoondna
        const profile = await Student.findOne({ user: req.user.id }).populate('admin', 'tuitionName');
        
        if (!profile) {
            return res.status(404).json({ message: "Student profile nahi mili" });
        }

        // Attendance records (Sirf Present wali ginte hain)
        const attendanceCount = await Attendance.countDocuments({
            "records.student": profile._id,
            "records.status": "Present"
        });

        // Automatic Fee Calculation
        const feeDetails = await calculateFeeDetails(profile);

        res.json({ 
            profile, 
            tuitionName: profile.admin ? profile.admin.tuitionName : "Academy",
            attendanceCount: attendanceCount,
            totalDue: feeDetails.totalDue, // Frontend ko pending fees dikhane ke liye
            feesHistory: feeDetails.paidHistory // Paid months ki list
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

        // Sirf apne teacher (admin) ki notices dikhayega
        const notices = await Notice.find({ tuitionId: student.admin }).sort({ createdAt: -1 }).limit(10);
        res.json(notices);
    } catch (err) {
        res.status(500).json({ message: "Notices fetch error", error: err.message });
    }
});

// ---------------------------------------------------------
// 3. PROFILE DETAILS
// ---------------------------------------------------------
router.get('/profile', protect, async (req, res) => {
    try {
        const profile = await Student.findOne({ user: req.user.id }).populate('admin', 'tuitionName');
        if (!profile) return res.status(404).json({ message: "Profile not found" });

        const attendanceRecords = await Attendance.find({ "records.student": profile._id });
        const feeDetails = await calculateFeeDetails(profile);

        res.json({ 
            profile, 
            tuitionName: profile.admin ? profile.admin.tuitionName : "Academy",
            attendanceCount: attendanceRecords.length,
            attendanceHistory: attendanceRecords,
            feeDetails: feeDetails
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;
