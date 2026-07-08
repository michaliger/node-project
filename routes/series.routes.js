const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ייבוא הקונטרולר
const seriesController = require('../controllers/series.controller');

// ==========================================
// 1. הגדרות Multer להעלאת קבצים
// ==========================================

// יצירת תיקיית uploads אם היא לא קיימת
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// הגדרת אחסון הקבצים
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir); 
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// ==========================================
// 2. הראוטים הרגילים שלך (CRUD)
// ==========================================

router.route('/')
    .get(seriesController.getAllSeries);

router.route('/id/:id')
    .get(seriesController.getSeriesById)
    .patch(seriesController.updateSeries)
    .delete(seriesController.deleteSeries);

router.route('/slug/:fileName')
    .get(seriesController.getSeriesBySlug);

// ==========================================
// 3. הראוט המיוחד: שמירה מאוחדת (מפנה לקונטרולר החכם שלנו!)
// ==========================================

// הראוט החדש והמשולב לשמירת כל הקטלוג (סדרה + גליונות + מאמרים) כולל העלאת קבצים
router.route('/save-full-catalog')
    .post(upload.any(), seriesController.createSeries); // <-- הוספנו את upload.any() כאן!

module.exports = router;