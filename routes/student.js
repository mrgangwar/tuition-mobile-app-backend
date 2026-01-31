const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Notice = require('../models/Notice'); 
const Fee = require('../models/Fees'); 
const User = require('../models/User'); 
const { protect } = require('../middleware/authMiddleware');

// ==========================================
// ⭐ INTERNAL HELPER: FEES CALCULATION
// ==========================================
const calculateFeeDetails = async (student) => {
    const start = new Date(student.joiningDate || student.createdAt);
    const today = new Date();
    
    let monthsElapsed = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
    monthsElapsed = monthsElapsed < 0 ? 0 : monthsElapsed + 1;

    const totalExpected = monthsElapsed * (student.feesPerMonth || 0);
    
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
        const profile = await Student.findOne({ user: req.user.id }).populate('admin', 'tuitionName');
        
        if (!profile) {
            return res.status(404).json({ 
                success: false, 
                message: "Student profile record not found." 
            });
        }

        const attendanceCount = await Attendance.countDocuments({
            "records.student": profile._id,
            "records.status": "Present"
        });

        const feeDetails = await calculateFeeDetails(profile);

        res.json({ 
            success: true,
            message: "Dashboard status retrieved successfully.",
            profile, 
            tuitionName: profile.admin ? profile.admin.tuitionName : "Academy",
            attendanceCount: attendanceCount,
            totalDue: feeDetails.totalDue,
            feesHistory: feeDetails.paidHistory 
        });
    } catch (err) {
        res.status(500).json({ 
            success: false, 
            message: "Failed to synchronize dashboard data.", 
            error: err.message 
        });
    }
});

// ---------------------------------------------------------
// 2. NOTICES (Frontend calls /student/notices)
// ---------------------------------------------------------
router.get('/notices', protect, async (req, res) => {
    try {
        const student = await Student.findOne({ user: req.user.id });
        if (!student) return res.status(404).json({ 
            success: false, 
            message: "Authorized student record not found." 
        });

        // ✅ FIX: Using 'tuitionId' as per model requirements
        const notices = await Notice.find({ tuitionId: student.admin }).sort({ date: -1 }).limit(10);
        
        res.json({
            success: true,
            message: "Notice board updated.",
            notices
        });
    } catch (err) {
        res.status(500).json({ 
            success: false, 
            message: "Unable to fetch latest notices.", 
            error: err.message 
        });
    }
});

// ---------------------------------------------------------
// 3. PROFILE DETAILS
// ---------------------------------------------------------
router.get('/profile', protect, async (req, res) => {
    try {
        const profile = await Student.findOne({ user: req.user.id }).populate('admin', 'tuitionName');
        if (!profile) return res.status(404).json({ 
            success: false, 
            message: "Profile information could not be retrieved." 
        });

        const attendanceRecords = await Attendance.find({ "records.student": profile._id });
        const feeDetails = await calculateFeeDetails(profile);

        res.json({ 
            success: true,
            message: "Profile details loaded.",
            profile, 
            tuitionName: profile.admin ? profile.admin.tuitionName : "Academy",
            attendanceCount: attendanceRecords.length,
            attendanceHistory: attendanceRecords,
            feeDetails: feeDetails
        });
    } catch (err) {
        res.status(500).json({ 
            success: false, 
            message: "Internal server error during profile retrieval.", 
            error: err.message 
        });
    }
});

module.exports = router;
