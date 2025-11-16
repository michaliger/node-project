const express = require('express');
const seriesRoutes = require('./routes/series.routes');
const volumeRoutes = require('./routes/volume.routes');
const subtitleRoutes = require('./routes/subtitle.routes');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use('/api/series', seriesRoutes);
app.use('/api/volumes', volumeRoutes);
app.use('/api/subtitles', subtitleRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);  // רק לאדמין

// 404
app.all('*', (req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `לא נמצא: ${req.originalUrl}`
  });
});

module.exports = app;