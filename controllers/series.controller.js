const Series = require('../models/series.model');
const Volume = require('../models/volume.model');
const Article = require('../models/subtitle.model');
const catchAsync = require('../utils/catchAsync');

// שליפת כל הסדרות
exports.getAllSeries = catchAsync(async (req, res) => {
    const series = await Series.find().sort({ createdAt: -1 }).populate({
        path: 'volumes',
        populate: { path: 'articles' }
    });
    res.status(200).json({ status: 'success', data: { series } });
});

// שליפה לפי ID - חשוב מאוד לעריכה!
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

// יצירת סדרה חדשה
// פונקציה חכמה שגם יוצרת סדרה חדשה וגם מעדכנת סדרה קיימת
exports.createSeries = catchAsync(async (req, res) => {
    const seriesData = JSON.parse(req.body.seriesData);
    console.log("=== השרת קיבל בקשת שמירה ===");
    console.log("ה-ID שהגיע מהריאקט הוא:", seriesData._id);
    const volumesData = req.body.volumes ? JSON.parse(req.body.volumes) : [];

    const coverFile = req.files && req.files.find(f => f.fieldname === 'coverImage');
    if (coverFile) {
        seriesData.coverImage = coverFile.filename || coverFile.path.replace(/\\/g, '/');
    }

    let savedSeries;

    // מצב א': עריכת סדרה קיימת (יש מזהה)
    if (seriesData._id) {
        savedSeries = await Series.findByIdAndUpdate(seriesData._id, seriesData, { new: true });
        const currentVolumeIds = [];

        for (let i = 0; i < volumesData.length; i++) {
            const volData = volumesData[i];
            const pdfFile = req.files && req.files.find(f => f.fieldname === `pdfFile_${i}`);
            if (pdfFile) volData.pdfPath = pdfFile.filename || pdfFile.path.replace(/\\/g, '/');

            let savedVolume;
            if (volData._id && volData._id.length === 24) {
                savedVolume = await Volume.findByIdAndUpdate(volData._id, volData, { new: true });
            } else {
                volData.series = savedSeries._id;
                savedVolume = await Volume.create(volData);
            }
            currentVolumeIds.push(savedVolume._id);

            if (volData.articles && volData.articles.length > 0) {
                const currentArticleIds = [];
                for (let j = 0; j < volData.articles.length; j++) {
                    const artData = volData.articles[j];
                    artData.contentTitle = artData.title || artData.contentTitle;
                    artData.startPage = parseInt(artData.page || artData.startPage) || 0;
                    artData.volume = savedVolume._id;
                    artData.series = savedSeries._id;

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
    }
    // מצב ב': יצירת סדרה חדשה (אין מזהה)
    else {
        savedSeries = await Series.create(seriesData);
        const currentVolumeIds = [];

        for (let i = 0; i < volumesData.length; i++) {
            const volData = volumesData[i];
            const pdfFile = req.files && req.files.find(f => f.fieldname === `pdfFile_${i}`);
            if (pdfFile) volData.pdfPath = pdfFile.filename || pdfFile.path.replace(/\\/g, '/');

            volData.series = savedSeries._id;
            const newVolume = await Volume.create(volData);
            currentVolumeIds.push(newVolume._id);

            if (volData.articles && volData.articles.length > 0) {
                const articlesToInsert = volData.articles.map(art => ({
                    ...art,
                    contentTitle: art.title || art.contentTitle,
                    startPage: parseInt(art.page || art.startPage) || 0,
                    volume: newVolume._id,
                    series: savedSeries._id
                }));
                const savedArticles = await Article.insertMany(articlesToInsert);
                await Volume.findByIdAndUpdate(newVolume._id, { articles: savedArticles.map(a => a._id) });
            }
        }
        await Series.findByIdAndUpdate(savedSeries._id, { volumes: currentVolumeIds });
    }

    res.status(200).json({ status: 'success', data: { series: savedSeries } });
});

// עדכון סדרה
exports.updateSeries = catchAsync(async (req, res) => {
    // בעדכון רגיל (PATCH) אנחנו מעדכנים רק את שדות הסדרה
    const series = await Series.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    }).populate('volumes');

    res.status(200).json({ status: 'success', data: { series } });
});

// מחיקת סדרה
exports.deleteSeries = catchAsync(async (req, res) => {
    await Series.findByIdAndDelete(req.params.id);
    res.status(204).json({ status: 'success', data: null });
});