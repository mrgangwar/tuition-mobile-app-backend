const mongoose = require('mongoose');

const FeeSchema = new mongoose.Schema({
    tuitionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    month: {
        type: String, 
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['Paid', 'Unpaid'],
        default: 'Unpaid'
    },
    paymentDate: {
        type: Date
    }
}, { timestamps: true });

// ✅ SAAS Fix: Unique constraint ab Teacher-Student-Month ke combination par hai
FeeSchema.index({ student: 1, month: 1, tuitionId: 1 }, { unique: true });

module.exports = mongoose.models.Fee || mongoose.model('Fee', FeeSchema);