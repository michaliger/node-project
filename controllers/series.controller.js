// controllers/series.controller.js
const Series = require('../models/series.model');
const Volume = require('../models/volume.model');
const Article = require('../models/subtitle.model');
const catchAsync = require('../utils/catchAsync');

// מאמר נחשב "בעל תוכן" אם מולא בו לפחות שדה משמעותי אחד -
// לא רק כותרת. כך מאמר עם מחבר בלבד, או מקור בלבד, או עמוד בלבד - עדיין נשמר.
const hasArticleContent = (art) => {
    if (!art) return false;
    const hasText = (v) => typeof v === 'string' && v.trim() !== '';

    if (hasText(art.title) || hasText(art.contentTitle)) return true;
    if (hasText(art.source)) return true;
    if (hasText(art.section)) return true;
    if (hasText(art.generalTopic)) return true;
    if (hasText(art.linkExplanation)) return true;
    if (hasText(art.linkedArticleId)) return true;
    if (art.page || art.startPage) return true;

    if (Array.isArray(art.authors)) {
        return art.authors.some(a =>
            hasText(a?.firstName) || hasText(a?.lastName) || hasText(a?.titlePrefix) || hasText(a?.role)
        );
    }
    return false;
};

// שליפת כל הסדרות
exports.getAllSeries = catchAsync(async (req, res) => {
    const series = await Series.find().sort({ createdAt: -1 }).populate({
        path: 'volumes',
        populate: { path: 'articles' }
    });
    res.status(200).json({ status: 'success', data: { series } });
});

// שליפה לפי ID
exports.getSeriesById = catchAsync(async (req, res) => {
    const series = await Series.findById(req.params.id).populate({
        path: 'volumes',
        populate: { path: 'articles' }
    });
    if (!series) return res.status(404).json({ status: 'fail', message: 'לא נמצא' });
    res.status(200).json({ status: 'success', data: { series } });
});

// שליפה לפי Slug
exports.getSeriesBySlug = catchAsync(async (req, res) => {
    const series = await Series.findOne({ fileName: req.params.fileName }).populate('volumes');
    if (!series) return res.status(404).json({ status: 'fail', message: 'לא נמצא' });
    res.status(200).json({ status: 'success', data: { series } });
});

// יצירת סדרה חדשה או עדכון קיימת
exports.createSeries = catchAsync(async (req, res) => {
    const seriesData = JSON.parse(req.body.seriesData);
    const volumesData = req.body.volumes ? JSON.parse(req.body.volumes) : [];

    const coverFile = req.files && req.files.find(f => f.fieldname === 'coverImage');
    if (coverFile) {
        seriesData.coverImage = coverFile.filename || coverFile.path.replace(/\\/g, '/');
    }

    let savedSeries;

    if (seriesData._id) {
        savedSeries = await Series.findByIdAndUpdate(seriesData._id, seriesData, { new: true });
        const currentVolumeIds = [];

        for (let i = 0; i < volumesData.length; i++) {
            const volData = volumesData[i];
            const pdfFile = req.files && req.files.find(f => f.fieldname === `pdfFile_${i}`);
            if (pdfFile) volData.pdfPath = pdfFile.filename || pdfFile.path.replace(/\\/g, '/');

            volData.title = volData.volumeTitle || volData.title || `גליון ${volData.volumeNumber || (i + 1)}`;
            volData.volumeNumber = parseInt(volData.volumeNumber) || (i + 1);

            const articlesTemp = volData.articles || [];
            volData.articles = []; 

            let savedVolume;
            if (volData._id && volData._id.length === 24) {
                savedVolume = await Volume.findByIdAndUpdate(volData._id, volData, { new: true });
            } else {
                volData.series = savedSeries._id;
                savedVolume = await Volume.create(volData);
            }
            currentVolumeIds.push(savedVolume._id);

            if (articlesTemp.length > 0) {
                const currentArticleIds = [];
                for (let j = 0; j < articlesTemp.length; j++) {
                    const artData = articlesTemp[j];
                    if (!hasArticleContent(artData)) continue;

                    artData.contentTitle = artData.title || artData.contentTitle;
                    let parsedPage = parseInt(artData.page || artData.startPage);
                    artData.startPage = (parsedPage && parsedPage >= 1) ? parsedPage : 1;
                    artData.volume = savedVolume._id;
                    artData.series = savedSeries._id;
                    artData.createdBy = savedSeries._id; 
                    artData.serialNumber = artData.autoId ? artData.autoId.toString() : (j + 1).toString();

                    if (!artData.linkedArticleId || artData.linkedArticleId === "") {
                        artData.linkedArticleId = null;
                    }

                    let savedArticle;
                    if (artData._id && artData._id.length === 24) {
                        savedArticle = await Article.findByIdAndUpdate(artData._id, artData, { new: true });
                    } else {
                        savedArticle = await Article.create(artData);
                    }
                    currentArticleIds.push(savedArticle._id);
                }
                await Volume.findByIdAndUpdate(savedVolume._id, { articles: currentArticleIds });
            }
        }
        await Series.findByIdAndUpdate(savedSeries._id, { volumes: currentVolumeIds });
    } else {
        savedSeries = await Series.create(seriesData);
        const currentVolumeIds = [];

        for (let i = 0; i < volumesData.length; i++) {
            const volData = volumesData[i];
            const pdfFile = req.files && req.files.find(f => f.fieldname === `pdfFile_${i}`);
            if (pdfFile) volData.pdfPath = pdfFile.filename || pdfFile.path.replace(/\\/g, '/');

            volData.title = volData.volumeTitle || volData.title || `גליון ${volData.volumeNumber || (i + 1)}`;
            volData.volumeNumber = parseInt(volData.volumeNumber) || (i + 1);

            const articlesTemp = volData.articles || [];
            volData.articles = [];

            volData.series = savedSeries._id;
            const newVolume = await Volume.create(volData);
            currentVolumeIds.push(newVolume._id);

            if (articlesTemp.length > 0) {
                const validArticles = articlesTemp.filter(hasArticleContent);
                const articlesToInsert = validArticles.map((art, idx) => {
                    let parsedPage = parseInt(art.page || art.startPage);
                    return {
                        ...art,
                        contentTitle: art.title || art.contentTitle,
                        startPage: (parsedPage && parsedPage >= 1) ? parsedPage : 1,
                        volume: newVolume._id,
                        series: savedSeries._id,
                        createdBy: savedSeries._id, 
                        serialNumber: art.autoId ? art.autoId.toString() : (idx + 1).toString(),
                        linkedArticleId: (!art.linkedArticleId || art.linkedArticleId === "") ? null : art.linkedArticleId
                    };
                });
                
                if (articlesToInsert.length > 0) {
                    const savedArticles = await Article.insertMany(articlesToInsert);
                    await Volume.findByIdAndUpdate(newVolume._id, { articles: savedArticles.map(a => a._id) });
                }
            }
        }
        await Series.findByIdAndUpdate(savedSeries._id, { volumes: currentVolumeIds });
    }

    res.status(200).json({ status: 'success', data: { series: savedSeries } });
});

// עדכון סדרה
exports.updateSeries = catchAsync(async (req, res) => {
    const series = await Series.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    }).populate('volumes');

    res.status(200).json({ status: 'success', data: { series } });
});

// מחיקת סדרה - תיקון מלא לניקוי נתונים
exports.deleteSeries = catchAsync(async (req, res) => {
    const series = await Series.findById(req.params.id);
    if (!series) return res.status(404).json({ status: 'fail', message: 'לא נמצא' });

    // חשוב: ל-Subtitle (המאמרים) אין שדה 'series' בסכמה - יש לו רק שדה 'volume'.
    // לכן קודם שולפים את כל ה-IDs של הכרכים השייכים לסדרה הזו,
    // ורק דרכם מוחקים את המאמרים המשויכים.
    const volumeIds = await Volume.find({ series: series._id }).distinct('_id');

    // מחיקת כל המאמרים המשויכים לכרכים האלה
    await Article.deleteMany({ volume: { $in: volumeIds } });

    // מחיקת כל הכרכים המשויכים
    await Volume.deleteMany({ series: series._id });

    // מחיקת הסדרה עצמה
    await series.deleteOne();

    res.status(204).json({ status: 'success', data: null });
});