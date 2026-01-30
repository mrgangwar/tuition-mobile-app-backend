const mongoose = require('mongoose'); 

const NoticeSchema = new mongoose.Schema({
    // ✅ PHASE 1 ADD-ON: Batayega ki notice kis teacher ka hai
    tuitionId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    date: { 
        type: Date, 
        default: Date.now 
    }
});

// ✅ Safe Export: OverwriteModelError se bachne ke liye logic
module.exports = mongoose.models.Notice || mongoose.model('Notice', NoticeSchema);