const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
    // ⭐ PHASE 1 ADD-ON: Yeh batayega ki yeh attendance kis teacher ki hai
    tuitionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    records: [
        {
            student: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Student',
                required: true
            },
            status: {
                type: String,
                enum: ['Present', 'Absent'],
                default: 'Present'
            }
        }
    ]
}, { timestamps: true });

// ✅ Compound Index: Isse Teacher A aur Teacher B dono same date par apni-apni attendance laga payenge
AttendanceSchema.index({ date: 1, tuitionId: 1 }, { unique: true });

// ✅ Safe Export: Overwrite error se bachne ke liye
module.exports = mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);