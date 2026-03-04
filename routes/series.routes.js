const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ייבוא הקונטרולר הרגיל
const seriesController = require('../controllers/series.controller');

// ייבוא כל המודלים (חשוב מאוד כדי שהכל יעבוד)
const Series = require('../models/series.model'); 
const Volume = require('../models/volume.model');
const Subtitle = require('../models/subtitle.model');

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
        cb(null, uploadDir); // <--- השינוי הוא כאן! הורדנו את הגרשיים ושמנו את המשתנה
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
    .get(seriesController.getAllSeries)
    .post(upload.any(), seriesController.createSeries);

router.route('/id/:id')
    .get(seriesController.getSeriesById)
    .patch(seriesController.updateSeries)
    .delete(seriesController.deleteSeries);

router.route('/slug/:fileName')
    .get(seriesController.getSeriesBySlug);

// ==========================================
// 3. הראוט המיוחד: שמירה מאוחדת (בטוחה ללא מחיקה)
// ==========================================

router.post('/save-full-catalog', upload.any(), async (req, res) => {
    try {
        let seriesData = typeof req.body.seriesData === 'string' ? JSON.parse(req.body.seriesData) : req.body.seriesData;
        let volumes = typeof req.body.volumes === 'string' ? JSON.parse(req.body.volumes) : req.body.volumes;

        if (!seriesData || !seriesData.fileName) {
            return res.status(400).json({ message: "חסרים נתוני סדרה" });
        }

        // --- 1. טיפול בקובץ הכריכה ועדכון הסדרה ---
        const coverFile = req.files.find(f => f.fieldname === 'coverImage');
        
        const seriesUpdate = {
            prefixName: seriesData.prefixName || "",
            fileName: seriesData.fileName,
            identifierName: seriesData.identifierName || "",
            details: seriesData.details || "",
            editor: seriesData.editor || "",
            publicationPlace: seriesData.publicationPlace || "",
            sector: seriesData.sector || "",
            catalogStatus: seriesData.catalogStatus || "טיוטה",
            missingVolumesList: seriesData.missingVolumesList || "",
            userNotes: seriesData.adminNotes || "",
            // אם עלה קובץ חדש - שומרים אותו, אחרת נשארים עם השם שהיה או ברירת המחדל
            coverImage: coverFile ? coverFile.filename : (seriesData.coverImage || "default-series.jpg")
        };

        const updatedSeries = await Series.findOneAndUpdate(
            { fileName: seriesData.fileName },
            { $set: seriesUpdate },
            { upsert: true, new: true }
        );

        // --- 2. טיפול בגליונות וה-PDF שלהם ---
        if (volumes && Array.isArray(volumes)) {
            // שולפים את כל קבצי ה-PDF שהגיעו בבקשה
            // const pdfFiles = req.files.filter(f => f.fieldname === 'pdfFiles');
            
            for (let [index, volData] of volumes.entries()) {
                const volNum = parseInt(volData.volumeNumber) || (index + 1);
                
                // התאמת קובץ ה-PDF לאינדקס של הגליון הנוכחי
                // התיקון: מחפשים את ה-PDF הספציפי של הגליון הזה לפי האינדקס שלו
                const volPdf = req.files.find(f => f.fieldname === `pdfFile_${index}`); 

                const volUpdate = {
                    volumeNumber: volNum,
                    title: volData.volumeTitle || `גליון ${volNum}`,
                    mainTopic: volData.mainTopic || "",
                    publicationYear: volData.publicationYear || "",
                    publicationMonth: volData.publicationPeriod || "",
                    occasion: volData.publishedFor || "",
                    volumeSize: volData.volumeSize || "",
                    coverType: volData.coverType || "",
                    // שומרים את השם החדש:
                    pdfPath: volPdf ? volPdf.filename : (volData.pdfFileName || ""),
                    series: updatedSeries._id,
                    createdBy: updatedSeries._id
                };

                const savedVolume = await Volume.findOneAndUpdate(
                    { series: updatedSeries._id, volumeNumber: volNum },
                    { $set: volUpdate },
                    { upsert: true, new: true }
                );

                // --- 3. טיפול במאמרים שבתוך הגליון ---
                if (volData.articles && Array.isArray(volData.articles)) {
                    const articleIds = [];
                    for (let artData of volData.articles) {
                        if (!artData.title) continue; // דילוג על מאמרים ריקים

                        const artUpdate = {
                            serialNumber: artData.autoId?.toString() || "1",
                            contentTitle: artData.title,
                            source: artData.source || "",
                            startPage: parseInt(artData.page) || null,
                            generalTopic: artData.generalTopic || "",
                            volume: savedVolume._id,
                            linkedArticleId: artData.linkedArticleId || null,
                            linkExplanation: artData.linkExplanation || "", 
                            createdBy: updatedSeries._id 
                        };

                        if (artData.authors) {
                            artUpdate.authors = artData.authors.map(a => ({
                                titlePrefix: a.titlePrefix || "",
                                firstName: a.firstName || "",
                                lastName: a.lastName || "",
                                role: a.role || "מחבר"
                            }));
                        }

                        const savedArt = await Subtitle.findOneAndUpdate(
                            { volume: savedVolume._id, contentTitle: artData.title },
                            { $set: artUpdate },
                            { upsert: true, new: true }
                        );
                        articleIds.push(savedArt._id);
                    }

                    // עדכון רשימת המאמרים בתוך הגליון הרלוונטי
                    await Volume.findByIdAndUpdate(savedVolume._id, {
                        $set: { articles: articleIds }
                    });
                }
            }
        }

        // --- 4. עדכון סופי של כל הגליונות בסדרה ---
        const allVols = await Volume.find({ series: updatedSeries._id }).select('_id');
        await Series.findByIdAndUpdate(updatedSeries._id, {
            $set: { volumes: allVols.map(v => v._id) }
        });

        res.status(200).json({ message: "נשמר בהצלחה כולל קבצים", data: updatedSeries });
    } catch (error) {
        console.error("ERROR:", error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;