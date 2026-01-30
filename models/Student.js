const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
    // User account se link karne ke liye
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // ⭐ PHASE 1 ADD-ON: Yeh batayega ki yeh student kis teacher ka hai
    tuitionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Personal Details
    name: {
        type: String,
        required: true
    },
    fatherName: {
        type: String,
        required: true // Papa ka naam zaroori hai
    },
    studentClass: {
        type: String,
        required: true // Kaunsi class mein hai
    },
    collegeName: {
        type: String,
        default: "N/A" // Agar school/college nahi bhara toh N/A dikhayega
    },
    // Contact & Fees
    parentPhone: {
        type: String,
        required: true
    },
    batch: {
        type: String,
        required: true
    },
    feesPerMonth: {
        type: Number,
        required: true
    },
    // Media & System Fields
    photo: {
        type: String, 
        default: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' // Default Profile Icon
    },
    joiningDate: {
        type: Date,
        default: Date.now // Jis din register hoga
    }
}, {
    timestamps: true // Isse createdAt aur updatedAt mil jayenge
});

module.exports = mongoose.model('Student', StudentSchema);