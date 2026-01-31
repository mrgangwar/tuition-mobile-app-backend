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
// ⭐ FEE CALCULATION HELPER (Enhanced)
// ==========================================
const calculateFeeDetails = async (student) => {
    const start = new Date(student.joiningDate || student.createdAt);
    const today = new Date();
    
    let monthsElapsed = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
    monthsElapsed = monthsElapsed < 0 ? 0 : monthsElapsed + 1;

    const totalExpected = monthsElapsed * student.feesPerMonth;
    
    const paidRecords = await Fee.find({ 
        student: student._id, 
        status: 'Paid',
        tuitionId: student.tuitionId 
    }).sort({ createdAt: -1 });
    
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
        
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        
        const attendanceRecord = await Attendance.findOne({ date: todayDate, tuitionId: req.user._id });
        let presentToday = attendanceRecord ? attendanceRecord.records.filter(r => r.status === 'Present').length : 0;
        
        const currentMonthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
        
        const feesPaid = await Fee.find({ 
            month: currentMonthName, 
            status: 'Paid', 
            tuitionId: req.user._id 
        });
        
        const totalCollection = feesPaid.reduce((sum, record) => sum + record.amount, 0);

        res.json({ 
            totalStudents, presentToday, totalCollection,
            tuitionName: adminProfile?.tuitionName || "EduSpark Academy"
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================
// 2. FEE MANAGEMENT ROUTES
// ============================

router.post('/collect-fee', protect, isAdmin, async (req, res) => {
    try {
        const { studentId, month, amount } = req.body;
        if (!studentId || !month || !amount) {
            return res.status(400).json({ error: "All fields are required" });
        }

        const feeRecord = await Fee.findOneAndUpdate(
            { student: studentId, month: month, tuitionId: req.user._id },
            { 
                tuitionId: req.user._id,
                student: studentId,
                month: month,
                amount: Number(amount),
                status: 'Paid',
                paymentDate: new Date()
            },
            { upsert: true, new: true, runValidators: true }
        );

        res.status(200).json({ success: true, message: `Fees for ${month} collected!`, feeRecord });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ error: "Record already exists for this month." });
        }
        res.status(500).json({ error: "Fee collection failed: " + err.message });
    }
});

router.get('/pending-fees-list', protect, isAdmin, async (req, res) => {
    try {
        const students = await Student.find({ tuitionId: req.user._id });
        const pendingList = [];

        for (let student of students) {
            const details = await calculateFeeDetails(student);
            if (details.totalDue > 0) {
                pendingList.push({
                    _id: student._id,
                    name: student.name,
                    batch: student.batch,
                    totalDue: details.totalDue,
                    feesPerMonth: student.feesPerMonth
                });
            }
        }
        pendingList.sort((a, b) => b.totalDue - a.totalDue);
        res.json(pendingList);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch pending list: " + err.message });
    }
});

router.get('/student-fee-status/:id', protect, isAdmin, async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) return res.status(404).json({ error: "Student not found" });
        const details = await calculateFeeDetails(student);
        res.json(details);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/my-fees-history', protect, async (req, res) => {
    try {
        const student = await Student.findOne({ user: req.user._id });
        if (!student) return res.status(404).json({ error: "Student profile not found" });
        const details = await calculateFeeDetails(student);
        res.json(details);
    } catch (err) {
        res.status(500).json({ error: "Fetch error: " + err.message });
    }
});

// ============================
// 3. STUDENT MANAGEMENT
// ============================

router.post('/add-student', protect, isAdmin, upload.single('photo'), async (req, res) => {
    const { name, email, password, parentPhone, batch, feesPerMonth, fatherName, collegeName, studentClass, joiningDate } = req.body;
    let newUser;
    try {
        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ message: "Email registered" });
        const salt = await bcrypt.genSalt(10);
        newUser = await User.create({ email, password: await bcrypt.hash(password, salt), role: 'STUDENT', tuitionId: req.user._id });
        const newStudent = await Student.create({
            user: newUser._id, tuitionId: req.user._id, name, fatherName, collegeName, studentClass, joiningDate,
            photo: req.file ? `/uploads/${req.file.filename}` : '', parentPhone, batch, feesPerMonth: Number(feesPerMonth)
        });
        sendEmail(email, "Welcome!", `Email: ${email}\nPass: ${password}`).catch(() => {});
        res.status(201).json({ success: true, student: newStudent });
    } catch (err) {
        if (newUser) await User.findByIdAndDelete(newUser._id);
        res.status(500).json({ error: err.message });
    }
});

router.put('/update-student/:id', protect, isAdmin, upload.single('photo'), async (req, res) => {
    try {
        let updateData = { ...req.body };
        if (req.file) {
            updateData.photo = `/uploads/${req.file.filename}`;
        }
        const updatedStudent = await Student.findOneAndUpdate(
            { _id: req.params.id, tuitionId: req.user._id },
            { $set: updateData },
            { new: true }
        );
        if (!updatedStudent) return res.status(404).json({ error: "Student not found" });
        res.json({ success: true, student: updatedStudent });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/delete-student/:id', protect, isAdmin, async (req, res) => {
    try {
        const student = await Student.findOne({ _id: req.params.id, tuitionId: req.user._id });
        if (!student) return res.status(404).json({ error: "Student not found" });
        
        await User.findByIdAndDelete(student.user);
        await Student.findByIdAndDelete(req.params.id);
        await Fee.deleteMany({ student: req.params.id });
        
        res.json({ success: true, message: "Student and records deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/students', protect, isAdmin, async (req, res) => {
    try {
        const students = await Student.find({ tuitionId: req.user._id })
            .populate('user', 'email')
            .sort({ name: 1 });
        res.json(students);
    } catch (err) {
        res.status(500).json({ error: "Fetch error: " + err.message });
    }
});

router.post('/attendance', protect, isAdmin, async (req, res) => {
    try {
        const { date, attendanceData } = req.body; 
        if (!attendanceData || !Array.isArray(attendanceData)) {
            return res.status(400).json({ error: "Attendance data missing" });
        }
        const attendanceDate = new Date(date);
        attendanceDate.setHours(0, 0, 0, 0);
        const attendance = await Attendance.findOneAndUpdate(
            { date: attendanceDate, tuitionId: req.user._id },
            { tuitionId: req.user._id, date: attendanceDate, records: attendanceData },
            { upsert: true, new: true }
        );
        res.json({ success: true, message: "Attendance saved!", attendance });
    } catch (err) {
        res.status(500).json({ error: "Save error: " + err.message });
    }
});

// ============================
// 4. NOTICE BOARD
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

router.delete('/notice/:id', protect, isAdmin, async (req, res) => {
    try {
        const notice = await Notice.findById(req.params.id);
        if (!notice) return res.status(404).json({ message: "Notice not found" });
        if (notice.tuitionId.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        await Notice.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Notice deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ============================
// ⚙️ 5. APP SETTINGS & UPDATES
// ============================

router.get('/app-settings', protect, isAdmin, async (req, res) => {
    try {
        const settings = await Notice.findOne({ type: 'APP_CONFIG' }); 
        
        if (!settings) {
            return res.json({
                latestVersion: '1.0.0',
                updateUrl: '',
                message: 'No updates deployed yet.'
            });
        }

        res.json({
            latestVersion: settings.title,
            updateUrl: settings.content,
            message: settings.extraMsg || ''
        });
    } catch (err) {
        res.status(500).json({ error: "Settings fetch failed: " + err.message });
    }
});

router.post('/update-app-version', protect, isAdmin, async (req, res) => {
    try {
        const { version, url, msg } = req.body;
        if (!version || !url) {
            return res.status(400).json({ error: "Version and URL are required" });
        }
        
        const updatedConfig = await Notice.findOneAndUpdate(
            { type: 'APP_CONFIG' },
            { 
                type: 'APP_CONFIG',
                title: version, 
                content: url, 
                extraMsg: msg,
                tuitionId: req.user._id 
            },
            { upsert: true, new: true }
        );

        res.json({ success: true, message: "New version deployed!", config: updatedConfig });
    } catch (err) {
        res.status(500).json({ error: "Deployment failed: " + err.message });
    }
});

router.get('/check-update', async (req, res) => {
    try {
        const settings = await Notice.findOne({ type: 'APP_CONFIG' });
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 🚀 ADD-ON: ROUTES FOR FEEMANAGER.JS
// ==========================================

// 1. Get monthly status for all students
router.get('/fees/status/:month', protect, isAdmin, async (req, res) => {
    try {
        const { month } = req.params;
        const students = await Student.find({ tuitionId: req.user._id }).sort({ name: 1 });
        
        const report = await Promise.all(students.map(async (student) => {
            const feeRecord = await Fee.findOne({ 
                student: student._id, 
                month: month, 
                status: 'Paid',
                tuitionId: req.user._id
            });
            
            return {
                studentId: student._id,
                name: student.name,
                batch: student.batch,
                parentPhone: student.parentPhone,
                feesPerMonth: student.feesPerMonth,
                status: feeRecord ? 'Paid' : 'Pending'
            };
        }));
        res.json(report);
    } catch (err) {
        res.status(500).json({ error: "Failed to load fee status: " + err.message });
    }
});

// 2. Mark fee as paid from FeeManager screen
router.post('/fees/pay', protect, isAdmin, async (req, res) => {
    try {
        const { studentId, month, amount } = req.body;
        const fee = await Fee.findOneAndUpdate(
            { student: studentId, month: month, tuitionId: req.user._id },
            { 
                amount: Number(amount), 
                status: 'Paid', 
                paymentDate: new Date(),
                tuitionId: req.user._id 
            },
            { upsert: true, new: true }
        );
        res.json({ success: true, fee });
    } catch (err) {
        res.status(500).json({ error: "Payment failed: " + err.message });
    }
});

module.exports = router;
