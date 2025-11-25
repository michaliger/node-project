const express = require('express');
const dotenv = require('dotenv');
const colors = require('colors');
const connectDB = require('./config/db');

// Routes
const seriesRoutes = require('./routes/series.routes');
const volumeRoutes = require('./routes/volume.routes');
const subtitleRoutes = require('./routes/subtitle.routes');
const authRoutes = require('./routes/auth.routes');

const cors = require('cors');



dotenv.config();
connectDB();

const app = express();
app.use(cors({
  origin: ['http://localhost:5174', 'http://localhost:5176', 'http://localhost:5175'],
  credentials: true
}));

// Middleware
app.use(express.json());

// Routes
app.use('/api/series', seriesRoutes);
app.use('/api/volumes', volumeRoutes);
app.use('/api/subtitles', subtitleRoutes);
app.use('/api/auth', authRoutes);


// רק אם באמת אין ראוט – 404
app.use((req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `לא נמצא: ${req.originalUrl}`
  });
});

module.exports = app;