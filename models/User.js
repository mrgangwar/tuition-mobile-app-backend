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
    // ✅ PHASE 2 ADD-ON: Jab koi Teacher (ADMIN) register karega, 
    // tab uski tuition ka stylish name yahan save hoga.
    tuitionName: {
        type: String,
        required: function() { return this.role === 'ADMIN'; } // Sirf Admin ke liye zaroori hai
    },
    // ✅ PHASE 1 ADD-ON: Yeh Student ko uske specific Teacher se link karega
    tuitionId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    } 
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);