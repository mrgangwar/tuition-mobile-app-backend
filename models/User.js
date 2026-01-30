const mongoose = require('mongoose'); // ✅ Yeh line add kar di taaki 'mongoose is not defined' wali error na aaye

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
    // ✅ PHASE 1 ADD-ON: Yeh Student ko uske specific Teacher se link karega
    tuitionId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    } 
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);