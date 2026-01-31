const mongoose = require('mongoose'); 

const UserSchema = new mongoose.Schema({
    email: { 
        type: String, 
        required: true, 
        unique: true 
    },
    password: { 
        type: String, 
        required: true 
    },
    role: { 
        type: String, 
        enum: ['ADMIN', 'STUDENT'], 
        default: 'STUDENT' 
    },
    // ✅ PHASE 2: Teacher ki tuition ka name
    tuitionName: {
        type: String,
        required: function() { return this.role === 'ADMIN'; }
    },
    // ✅ PHASE 1: Student ko teacher se connect karne ke liye
    tuitionId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },

    // 🔑 NEW SECURITY ADD-ON: Forgot Password Logic
    resetOTP: {
        type: String // 4-digit code yahan save hoga
    },
    otpExpires: {
        type: Date // Code kitni der tak valid rahega (e.g., 10 mins)
    }

}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);