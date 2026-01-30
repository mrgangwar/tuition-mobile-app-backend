const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path'); // ✅ Path module add kiya static files ke liye

dotenv.config();

const app = express();

// ✅ REQUIRED FOR MONGOOSE DELETE/UPDATE
mongoose.set("strictQuery", false);

// ============================
// 🛠️ MIDDLEWARES
// ============================
app.use(cors()); // Sabhi origins ko allow karega
app.use(express.json()); // JSON data handle karne ke liye

// ✅ Static Folder (Taaki mobile app student photos dekh sake)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============================
// 🚀 ROUTES
// ============================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/student', require('./routes/student'));

// ============================
// 🗄️ DATABASE CONNECTION
// ============================
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000
    });

    console.log("✅ MongoDB Connected Successfully");
    console.log("📦 Database Name:", conn.connection.name);

  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

connectDB();

// ============================
// 📡 SERVER STARTUP
// ============================
const PORT = process.env.PORT || 5000;

// ✅ IMPORTANT: '0.0.0.0' lagane se mobile app connect ho payega
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on Port: ${PORT}`);
  console.log(`🏠 Local Access: http://localhost:${PORT}`);
  // Yahan apna IP Address terminal mein print karne ke liye:
  console.log(`🌐 Network Access: http://10.54.31.32:${PORT}`); 
});