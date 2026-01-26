const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ייבוא ה-Controller
const seriesController = require('../controllers/series.controller');

// --- הגדרת Multer בטוחה ---

// יצירת תיקיית uploads אם היא לא קיימת פיזית (מונע שגיאת ENOENT)
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // הנתיב יחסית לשורש הפרויקט
    },
    filename: (req, file, cb) => {
        // יצירת שם קובץ ייחודי: זמן נוכחי + מספר רנדומלי + סיומת מקורית
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// הגדרת פילטר לקבצים (אופציונלי - רק תמונות ו-PDF)
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('סוג קובץ לא נתמך! ניתן להעלות רק PDF ותמונות.'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 20 * 1024 * 1024 } // הגבלה ל-20MB למשל
});

// --- הגדרת הראוטים ---

// נתיב: /api/series
router
    .route('/')
    .get(seriesController.getAllSeries)
    .post(upload.any(), seriesController.createSeries); // שימוש ב-any() כי יש לנו שמות שדות דינמיים לגליונות

// נתיב: /api/series/:fileName (לחיפוש לפי שם הקובץ)
router
    .route('/:fileName')
    .get(seriesController.getSeriesBySlug);

// נתיב: /api/series/:id (לעדכון ומחיקה לפי ObjectId)
router
    .route('/:id')
    .patch(seriesController.updateSeries)
    .delete(seriesController.deleteSeries);

module.exports = router;