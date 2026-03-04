const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const seriesController = require('../controllers/series.controller');

// יצירת תיקיית uploads אם היא לא קיימת
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// הגדרת Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// הגדרת הראוטים
// נתיב: /api/series
router.route('/')
    .get(seriesController.getAllSeries)
    .post(upload.any(), seriesController.createSeries);

// נתיב: /api/series/id/:id (לפי ה-ID של מונגו)
router.route('/id/:id')
    .get(seriesController.getSeriesById)
    .patch(seriesController.updateSeries)
    .delete(seriesController.deleteSeries);

// נתיב: /api/series/slug/:fileName
router.route('/slug/:fileName')
    .get(seriesController.getSeriesBySlug);
// נתיב לשמירת קטלוג מלא (כולל סדרה, גליונות, ומאמרים - תואם לבקשה מריאקט)
router.post('/save-full-catalog', upload.any(), seriesController.createSeries);

module.exports = router;