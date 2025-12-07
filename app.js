const express = require('express');
const dotenv = require('dotenv');
const colors = require('colors');
const connectDB = require('./config/db');

// ראוטים
const seriesRoutes = require('./routes/series.routes');
const volumeRoutes = require('./routes/volume.routes');
const subtitleRoutes = require('./routes/subtitle.routes');
const authRoutes = require('./routes/auth.routes');

const cors = require('cors');

dotenv.config();
connectDB();

const app = express();

// ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
// פתרון CORS – חייב להיות בדיוק ככה!
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176'],
  credentials: true
}));
// ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←

app.use(express.json());

// ראוטים
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

// הפעלת השרת – חייב להיות בסוף הקובץ!
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`שרת רץ על פורט ${PORT} 🚀`.green.bold);
  console.log(`http://localhost:${PORT}`.cyan);
});

module.exports = app; // נשאר אם אתה מייבא במקום אחר (למשל בטסטים)