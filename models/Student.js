const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
    // User account (email/password) se link karne ke liye
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Yeh batayega ki yeh student kis teacher (Admin) ka hai
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
        required: true
    },
    studentClass: {
        type: String,
        required: true
    },
    collegeName: {
        type: String,
        default: "N/A"
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
        default: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
    },
    // ⭐ ADMIN FILL KAREGA: Isi se automatic fees calculate hogi
    joiningDate: {
        type: Date,
        required: true, // Ab admin ko ise bharna hi hoga
        default: Date.now 
    }
}, {
    timestamps: true // Isse createdAt aur updatedAt mil jayenge
});

module.exports = mongoose.models.Student || mongoose.model('Student', StudentSchema);
