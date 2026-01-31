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
const Settings = require('../models/Settings');
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
    
    if (monthsElapsed <= 0) {
        monthsElapsed = 1; 
    } else {
        monthsElapsed += 1;
    }

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
// 1. ANALYTICS (DASHBOARD) - Updated for Branding
// ============================
router.get('/analytics', protect, isAdmin, async (req, res) => {
    try {
        // ✅ ADMIN KA BRAND NAME FETCH KIYA
        const adminProfile = await User.findById(req.user._id).select('tuitionName');

        const query = { tuitionId: req.user._id }; 
        const totalStudents = await Student.countDocuments(query);
        
        const todayStr = new Date().toISOString().split('T')[0];
        const todayDate = new Date(todayStr);

        const attendanceRecord = await Attendance.findOne({ 
            date: todayDate, 
            tuitionId: req.user._id 
        });
        
        let presentToday = 0;
        if (attendanceRecord) {
            presentToday = attendanceRecord.records.filter(r => r.status === 'Present').length;
        }

        const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
        
        const feesPaid = await Fee.find({ 
            month: currentMonth, 
            status: 'Paid',
            tuitionId: req.user._id 
        });
        
        const totalCollection = feesPaid.reduce((sum, record) => sum + record.amount, 0);

        // ✅ Response mein Stats + Brand Name dono hai
        res.json({ 
            totalStudents, 
            presentToday, 
            totalCollection,
            tuitionName: adminProfile?.tuitionName || "EduSpark Academy"
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================
// 2. STUDENT MY-STATUS (For Student Portal Branding)
// ============================
router.get('/my-status', protect, async (req, res) => {
    try {
        // Student ki profile dhoondna aur uske Admin se 'tuitionName' nikalna
        const studentProfile = await Student.findOne({ user: req.user._id })
            .populate('tuitionId', 'tuitionName'); 

        if (!studentProfile) {
            return res.status(404).json({ message: "Student profile not found" });
        }

        const attendanceCount = await Attendance.countDocuments({
            tuitionId: studentProfile.tuitionId,
            "records.student": studentProfile._id,
            "records.status": 'Present'
        });

        const feesHistory = await Fee.find({ student: studentProfile._id }).sort({ paymentDate: -1 });

        res.json({
            profile: studentProfile,
            attendanceCount,
            feesHistory,
            // ✅ Student dashboard ko teacher ka brand name mil gaya
            tuitionName: studentProfile.tuitionId ? studentProfile.tuitionId.tuitionName : "My Coaching"
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ✅ Pending Fees List (Filtered)
router.get('/pending-fees-list', protect, isAdmin, async (req, res) => {
    try {
        const students = await Student.find({ tuitionId: req.user._id });
        const pendingList = [];

        for (let student of students) {
            const { totalDue, paidHistory } = await calculateFeeDetails(student);
            if (totalDue > 0) {
                pendingList.push({
                    _id: student._id,
                    name: student.name,
                    totalDue: totalDue,
                    parentPhone: student.parentPhone,
                    photo: student.photo,
                    batch: student.batch,
                    paidHistory: paidHistory
                });
            }
        }
        res.json(pendingList);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================
// 3. STUDENT MANAGEMENT
// ============================
router.post('/add-student', protect, isAdmin, upload.single('photo'), async (req, res) => {
    const { name, email, password, parentPhone, batch, feesPerMonth, fatherName, collegeName, studentClass } = req.body;
    let newUser;
    try {
        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ message: "Email already registered" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        newUser = await User.create({ 
            email, 
            password: hashedPassword, 
            role: 'STUDENT',
            tuitionId: req.user._id 
        });

        const photoPath = req.file ? `/uploads/${req.file.filename}` : '';

        const newStudent = await Student.create({
            user: newUser._id, 
            tuitionId: req.user._id, 
            name, fatherName, collegeName, studentClass,
            photo: photoPath,
            parentPhone, batch, 
            feesPerMonth: Number(feesPerMonth)
        });

        try {
            sendEmail(email, "Welcome!", `Login Email: ${email}\nPassword: ${password}`); 
        } catch (e) { console.log("Email error ignored"); }

        res.status(201).json({ success: true, student: newStudent });
    } catch (err) {
        if (newUser) await User.findByIdAndDelete(newUser._id);
        res.status(500).json({ error: err.message });
    }
});

router.get('/students', protect, isAdmin, async (req, res) => {
    try {
        const students = await Student.find({ tuitionId: req.user._id }).populate('user', 'email');
        res.status(200).json(students);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================
// 4. ATTENDANCE & 5. FEES
// ============================
router.post('/attendance', protect, isAdmin, async (req, res) => {
    const { date, attendanceData } = req.body; 
    try {
        const record = await Attendance.findOneAndUpdate(
            { date: new Date(date), tuitionId: req.user._id }, 
            { records: attendanceData, tuitionId: req.user._id }, 
            { upsert: true, new: true }
        );
        res.status(200).json({ success: true, record });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/fees/pay', protect, isAdmin, async (req, res) => {
    const { studentId, amount } = req.body;
    try {
        const feeUpdate = await Fee.create({
            student: studentId,
            tuitionId: req.user._id,
            month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
            amount: Number(amount),
            status: 'Paid',
            paymentDate: new Date()
        });
        res.status(200).json({ success: true, feeUpdate });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================
// 6. NOTICE BOARD
// ============================
router.post('/add-notice', protect, isAdmin, async (req, res) => {
    try {
        const { title, content } = req.body;
        const notice = await Notice.create({ 
            title, 
            content, 
            tuitionId: req.user._id 
        });
        res.status(201).json({ success: true, notice });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/notices', protect, async (req, res) => {
    try {
        const targetId = req.user.role === 'ADMIN' ? req.user._id : req.user.tuitionId;
        const notices = await Notice.find({ tuitionId: targetId }).sort({ date: -1 });
        res.json(notices);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;