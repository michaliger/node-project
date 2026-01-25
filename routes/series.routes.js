const express = require('express');
const multer = require('multer');
const path = require('path');
const { 
  getAllSeries, 
  getSeriesBySlug, 
  createSeries, // הפונקציה הזו תעודכן ב-Controller
  updateSeries, 
  deleteSeries 
} = require('../controllers/series.controller');
const { seedFullSeries } = require('../controllers/seed.controller');

const router = express.Router();

// --- הגדרת Multer לקליטת קבצים ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// הראוט המרכזי - הוספנו את upload.any() לפני ה-createSeries
router
  .route('/')
  .get(getAllSeries)
  .post(upload.any(), createSeries); // כאן קורה הקסם שמקבל את הקבצים

router
  .route('/:fileName')
  .get(getSeriesBySlug);

router
  .route('/:id')
  .patch(updateSeries)
  .delete(deleteSeries);

router.post('/seed-full', seedFullSeries);

module.exports = router;