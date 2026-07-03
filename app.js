const express = require('express');
const dotenv = require('dotenv');
const colors = require('colors');
const connectDB = require('./config/db');
const path = require('path');

// ראוטים
const seriesRoutes = require('./routes/series.routes');
const volumeRoutes = require('./routes/volume.routes');
const subtitleRoutes = require('./routes/subtitle.routes');
const authRoutes = require('./routes/auth.routes');
console.log('authRoutes:', authRoutes);

const cors = require('cors');

dotenv.config();
connectDB();

const app = express();
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// פתרון CORS
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176'],
  credentials: true
}));

app.use(express.json());

// ראוטים (שימי לב לקידומת /api בפניות מה-React)
app.use('/api/series', seriesRoutes);
app.use('/api/volumes', volumeRoutes);
app.use('/api/subtitles', subtitleRoutes);
app.use('/api/auth', authRoutes);

// 404 – אם אין ראוט
app.use((req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `לא נמצא: ${req.originalUrl}`
  });
});

module.exports = app;
