const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const dotenv = require('dotenv');

dotenv.config();

const seedAdmin = async () => {
    await mongoose.connect(process.env.MONGO_URI);

    // Check if admin already exists
    const adminExists = await User.findOne({ email: 'admin@tuition.com' });
    if (adminExists) {
        console.log("Admin already exists!");
        process.exit();
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    const admin = new User({
        email: 'admin@tuition.com',
        password: hashedPassword,
        role: 'ADMIN'
    });

    await admin.save();
    console.log("✅ Admin Created! Email: admin@tuition.com | Pass: admin123");
    process.exit();
};

seedAdmin();