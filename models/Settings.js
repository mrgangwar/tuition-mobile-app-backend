const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
    // ✅ SAAS Filter: Iske bina doosre teachers ko bhi notice dikh jayega
    tuitionId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    title: { type: String, required: true },
    content: { type: String, required: true },
    date: { type: Date, default: Date.now }
});

// ✅ Safe Export: OverwriteModelError se bachne ke liye
module.exports = mongoose.models.Notice || mongoose.model('Notice', noticeSchema);