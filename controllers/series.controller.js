const Series = require('../models/series.model');
const Volume = require('../models/volume.model');
const Article = require('../models/subtitle.model');
const catchAsync = require('../utils/catchAsync');

// --- פונקציות עזר (היו חסרות בקוד ששלחת) ---

exports.getAllSeries = catchAsync(async (req, res) => {
    const series = await Series.find().sort({ createdAt: -1 });
    res.status(200).json({ status: 'success', results: series.length, data: { series } });
});

exports.getSeriesBySlug = catchAsync(async (req, res) => {
    const series = await Series.findOne({ fileName: req.params.fileName }).populate('volumes');
    if (!series) return res.status(404).json({ status: 'fail', message: 'לא נמצא' });
    res.status(200).json({ status: 'success', data: { series } });
});

exports.updateSeries = catchAsync(async (req, res) => {
    const series = await Series.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.status(200).json({ status: 'success', data: { series } });
});

exports.deleteSeries = catchAsync(async (req, res) => {
    await Series.findByIdAndDelete(req.params.id);
    res.status(204).json({ status: 'success', data: null });
});

// --- הפונקציה המרכזית שלך ---

exports.createSeries = catchAsync(async (req, res) => {
    const allData = JSON.parse(req.body.seriesData);
    
    // הפרדה מוחלטת של הגליונות כדי למנוע כפילויות ואינדקס 0 שגוי
    const { volumes: volumesData, ...seriesToSave } = allData;

    // טיפול בתמונה - הסרת כתובות placeholder
    const coverFile = req.files.find(f => f.fieldname === 'coverImage');
    if (coverFile) {
        seriesToSave.coverImage = coverFile.path.replace(/\\/g, '/');
    } else {
        seriesToSave.coverImage = null; // שלא יהיה placeholder
    }

    // יצירת סדרה - וודאי שמערך volumes ריק לחלוטין כאן
    seriesToSave.volumes = []; 
    const newSeries = await Series.create(seriesToSave);

    if (volumesData && volumesData.length > 0) {
        for (let i = 0; i < volumesData.length; i++) {
            const volData = volumesData[i];
            const { articles: articlesData, ...volumeToSave } = volData;

            // יצירת גליון נקי
            const pdfFile = req.files.find(f => f.fieldname === `pdf_vol_${i}`);
            
            // מחיקת ID ישן כדי שמונגו יצור חדש
            delete volumeToSave._id; 
            delete volumeToSave.id;

            const newVolume = await Volume.create({
                ...volumeToSave,
                series: newSeries._id,
                pdfPath: pdfFile ? pdfFile.path.replace(/\\/g, '/') : null,
                createdBy: allData.createdBy,
                articles: []
            });

            // שמירת מאמרים - מיפוי שדות קפדני
            if (articlesData && articlesData.length > 0) {
                const articlesToInsert = articlesData.map((art, index) => ({
                    // שימי לב: השמות כאן חייבים להיות בול כמו ב-subtitle.model.js
                    contentTitle: art.title || art.contentTitle, 
                    startPage: parseInt(art.page || art.startPage) || 0,
                    serialNumber: art.serialNumber || `${i + 1}-${index + 1}`,
                    generalTopic: art.generalTopic || "",
                    authors: art.authors || [], // וודאי שזה מערך
                    volume: newVolume._id,
                    series: newSeries._id,
                    createdBy: allData.createdBy
                }));

                const savedArticles = await Article.insertMany(articlesToInsert);
                
                // עדכון הגליון עם ה-IDs של המאמרים
                await Volume.findByIdAndUpdate(newVolume._id, {
                    $set: { articles: savedArticles.map(a => a._id) }
                });
            }

            // עדכון הסדרה עם ה-ID של הגליון
            await Series.findByIdAndUpdate(newSeries._id, {
                $push: { volumes: newVolume._id }
            });
        }
    }

    res.status(201).json({ status: 'success', data: newSeries });
});