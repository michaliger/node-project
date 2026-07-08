const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// ייבוא הקונטרולר
const seriesController = require('../controllers/series.controller');

// ==========================================\
// 1. הגדרות Cloudinary ו-Multer להעלאת קבצים לענן
// ==========================================\

// הגדרת החיבור לענן שלך לפי הפרטים שקיבלת
cloudinary.config({
  cloud_name: 'zqgbyjp9',
  api_key: '346468923129492',
  api_secret: 'dWQxubxrZUdtO16oGASqCSXmGdQ'
});

// הגדרת האחסון שיעלה ישירות לענן במקום לדיסק של השרת
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'torahfiles_uploads', // שם התיקייה שתיפתח אוטומטית בענן שלך
    allowed_formats: ['jpg', 'png', 'jpeg', 'pdf'], // סוגי קבצים מותרים
    resource_type: 'auto' // מאפשר העלאת PDF ותמונות יחד
  },
});

const upload = multer({ storage: storage });

// ==========================================\
// 2. הראוטים הרגילים (CRUD)
// ==========================================\

router.route('/')
    .get(seriesController.getAllSeries);

router.route('/id/:id')
    .get(seriesController.getSeriesById)
    .patch(seriesController.updateSeries)
    .delete(seriesController.deleteSeries);

router.route('/slug/:fileName')
    .get(seriesController.getSeriesBySlug);

// הראוט המשולב לשמירת כל הקטלוג (סדרה + גליונות + מאמרים) כולל העלאת קבצים ישירות לענן
router.route('/save-full-catalog')
    .post(upload.any(), seriesController.createSeries);

module.exports = router;