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
exports.createSeries = catchAsync(async (req, res) => {
    const allData = JSON.parse(req.body.seriesData);
    const { volumes: volumesData, ...seriesToSave } = allData;

    const coverFile = req.files.find(f => f.fieldname === 'coverImage');
    seriesToSave.coverImage = coverFile ? coverFile.path.replace(/\\/g, '/') : null;
    seriesToSave.volumes = [];

    const newSeries = await Series.create(seriesToSave);

    if (volumesData && volumesData.length > 0) {
        for (let i = 0; i < volumesData.length; i++) {
            const volData = volumesData[i];
            const { articles: articlesData, ...volumeToSave } = volData;
            const pdfFile = req.files.find(f => f.fieldname === `pdf_vol_${i}`);

            const newVolume = await Volume.create({
                ...volumeToSave,
                series: newSeries._id,
                pdfPath: pdfFile ? pdfFile.path.replace(/\\/g, '/') : null,
                articles: []
            });

            if (articlesData && articlesData.length > 0) {
                const articlesToInsert = articlesData.map((art, idx) => ({
                    contentTitle: art.title || art.contentTitle,
                    startPage: parseInt(art.page || art.startPage) || 0,
                    volume: newVolume._id,
                    series: newSeries._id
                }));
                const savedArticles = await Article.insertMany(articlesToInsert);
                await Volume.findByIdAndUpdate(newVolume._id, {
                    $set: { articles: savedArticles.map(a => a._id) }
                });
            }
            await Series.findByIdAndUpdate(newSeries._id, { $push: { volumes: newVolume._id } });
        }
    }
    res.status(201).json({ status: 'success', data: newSeries });
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