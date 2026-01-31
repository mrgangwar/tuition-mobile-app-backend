const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer'); 
const path = require('path');  

// Models Import
const User = require('../models/User');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Fee = require('../models/Fees');
const Notice = require('../models/Notice');

// Utility Import
const sendEmail = require('../utils/emailHelper');

// Middleware
const { protect, isAdmin } = require('../middleware/authMiddleware');

// ============================
// 📸 PHOTO UPLOAD SETUP
// ============================
const storage = multer.diskStorage({
    destination: './uploads/', 
    filename: (req, file, cb) => {
        cb(null, 'student-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage, limits: { fileSize: 3000000 } });

// ==========================================
// ⭐ FEE CALCULATION HELPER
// ==========================================
const calculateFeeDetails = async (student) => {
    const start = new Date(student.createdAt || student.joiningDate);
    const today = new Date();
    
    let monthsElapsed = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
    monthsElapsed = monthsElapsed <= 0 ? 1 : monthsElapsed + 1;

    const totalExpected = monthsElapsed * student.feesPerMonth;
    const paidRecords = await Fee.find({ 
        student: student._id, 
        status: 'Paid',
        tuitionId: student.tuitionId 
    }).sort({ paymentDate: -1 });
    
    const totalPaid = paidRecords.reduce((sum, f) => sum + f.amount, 0);
    const totalDue = totalExpected - totalPaid;

    return {
        totalDue: totalDue > 0 ? totalDue : 0,
        monthsCount: monthsElapsed,
        paidHistory: paidRecords
    };
};

// ============================
// 1. ANALYTICS (DASHBOARD)
// ============================
router.get('/analytics', protect, isAdmin, async (req, res) => {
    try {
        const adminProfile = await User.findById(req.user._id).select('tuitionName');
        const query = { tuitionId: req.user._id }; 
        const totalStudents = await Student.countDocuments(query);
        
        const todayDate = new Date(new Date().toISOString().split('T')[0]);
        const attendanceRecord = await Attendance.findOne({ date: todayDate, tuitionId: req.user._id });
        
        let presentToday = attendanceRecord ? attendanceRecord.records.filter(r => r.status === 'Present').length : 0;
        const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
        const feesPaid = await Fee.find({ month: currentMonth, status: 'Paid', tuitionId: req.user._id });
        const totalCollection = feesPaid.reduce((sum, record) => sum + record.amount, 0);

        res.json({ 
            totalStudents, presentToday, totalCollection,
            tuitionName: adminProfile?.tuitionName || "EduSpark Academy"
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================
// 2. NOTICE BOARD (Fixed & Complete)
// ============================
router.post('/add-notice', protect, isAdmin, async (req, res) => {
    try {
        const { title, content } = req.body;
        const notice = await Notice.create({ title, content, tuitionId: req.user._id });
        res.status(201).json({ success: true, notice });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/notices', protect, async (req, res) => {
    try {
        const targetId = req.user.role === 'ADMIN' ? req.user._id : req.user.tuitionId;
        const notices = await Notice.find({ tuitionId: targetId }).sort({ createdAt: -1 });
        res.json(notices);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ✅ FIXED: DELETE ROUTE ADDED
router.delete('/notice/:id', protect, isAdmin, async (req, res) => {
    try {
        const notice = await Notice.findById(req.params.id);
        if (!notice) return res.status(404).json({ message: "Notice not found" });
        if (notice.tuitionId.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: "Unauthorized delete attempt" });
        }
        await Notice.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Notice deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================
// 3. STUDENT & OTHER ROUTES (As provided before)
// ============================
router.get('/my-status', protect, async (req, res) => {
    try {
        const studentProfile = await Student.findOne({ user: req.user._id }).populate('tuitionId', 'tuitionName'); 
        if (!studentProfile) return res.status(404).json({ message: "Student not found" });
        const attendanceCount = await Attendance.countDocuments({
            tuitionId: studentProfile.tuitionId,
            "records.student": studentProfile._id,
            "records.status": 'Present'
        });
        const feesHistory = await Fee.find({ student: studentProfile._id }).sort({ paymentDate: -1 });
        res.json({ profile: studentProfile, attendanceCount, feesHistory, tuitionName: studentProfile.tuitionId?.tuitionName || "My Coaching" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/add-student', protect, isAdmin, upload.single('photo'), async (req, res) => {
    const { name, email, password, parentPhone, batch, feesPerMonth, fatherName, collegeName, studentClass } = req.body;
    let newUser;
    try {
        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ message: "Email registered" });
        const salt = await bcrypt.genSalt(10);
        newUser = await User.create({ email, password: await bcrypt.hash(password, salt), role: 'STUDENT', tuitionId: req.user._id });
        const newStudent = await Student.create({
            user: newUser._id, tuitionId: req.user._id, name, fatherName, collegeName, studentClass,
            photo: req.file ? `/uploads/${req.file.filename}` : '', parentPhone, batch, feesPerMonth: Number(feesPerMonth)
        });
        sendEmail(email, "Welcome!", `Email: ${email}\nPass: ${password}`).catch(() => {});
        res.status(201).json({ success: true, student: newStudent });
    } catch (err) {
        if (newUser) await User.findByIdAndDelete(newUser._id);
        res.status(500).json({ error: err.message });
    }
});

// ============================
// 👥 GET ALL STUDENTS (For Attendance/List)
// ============================
router.get('/students', protect, isAdmin, async (req, res) => {
    try {
        // Sirf wahi students dikhao jo is Admin (tuitionId) ke hain
        const students = await Student.find({ tuitionId: req.user._id })
            .populate('user', 'email') // User model se email bhi le aao
            .sort({ name: 1 }); // A-Z format mein list
            
        res.json(students);
    } catch (err) {
        res.status(500).json({ error: "Students fetch nahi ho paye: " + err.message });
    }
});

module.exports = router;
