// controllers/series.controller.js
const Series = require('../models/series.model');
const Volume = require('../models/volume.model');
const Article = require('../models/subtitle.model');
const catchAsync = require('../utils/catchAsync');
const cloudinary = require('cloudinary').v2;

// המפתחות עברו למשתני סביבה (ב-Render: Environment). ראי הסבר בהודעה.
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// בודקת אם יש ערך כלשהו במאמר
const hasArticleContent = (art) => {
    if (!art) return false;

    return Object.entries(art).some(([key, value]) => {
        if (key === '_id' || key === 'id' || key === 'volume' || key === 'series') return false;

        if (typeof value === 'string' && value.trim() !== '') return true;
        if (typeof value === 'number' && !isNaN(value)) return true;

        if (key === 'authors' && Array.isArray(value)) {
            return value.some(a =>
                (a?.firstName && a.firstName.trim() !== '') ||
                (a?.lastName && a.lastName.trim() !== '') ||
                (a?.titlePrefix && a.titlePrefix.trim() !== '') ||
                (a?.role && a.role.trim() !== '')
            );
        }

        return false;
    });
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
    try {
        const seriesData = JSON.parse(req.body.seriesData);
        const volumesData = req.body.volumes ? JSON.parse(req.body.volumes) : [];

        if (!seriesData.fileName || seriesData.fileName.trim() === '') {
            return res.status(400).json({
                status: 'fail',
                message: 'שם הכותר (fileName) חובה ולא יכול להיות ריק'
            });
        }

        const coverFile = req.files && req.files.find(f => f.fieldname === 'coverImage');
        if (coverFile) {
            seriesData.coverImage = coverFile.path;
        }

        let savedSeries;

        if (seriesData._id && seriesData._id.length === 24) {
            savedSeries = await Series.findByIdAndUpdate(seriesData._id, seriesData, { new: true });
        } else {
            delete seriesData._id;
            delete seriesData.id;
            savedSeries = await Series.create(seriesData);
        }

        const currentVolumeIds = [];

        for (let i = 0; i < volumesData.length; i++) {
            const volData = volumesData[i];

            const pdfFile = req.files && req.files.find(f => f.fieldname === `pdfFile_${i}`);
            if (pdfFile) {
                volData.pdfPath = pdfFile.path;
            }

            volData.title = volData.volumeTitle || volData.title || `גליון ${volData.volumeNumber || (i + 1)}`;
            volData.volumeNumber = parseInt(volData.volumeNumber) || (i + 1);
            volData.publicationMonth = volData.publicationPeriod || volData.publicationMonth || '';
            volData.occasion = volData.publishedFor || volData.occasion || '';

            const articlesTemp = volData.articles || [];
            volData.articles = [];

            let savedVolume;
            const volumeId = volData._id || volData.id;
            if (volumeId && volumeId.length === 24) {
                savedVolume = await Volume.findByIdAndUpdate(volumeId, volData, { new: true });
            } else {
                delete volData._id;
                delete volData.id;
                volData.series = savedSeries._id;
                savedVolume = await Volume.create(volData);
            }
            currentVolumeIds.push(savedVolume._id);

            if (articlesTemp.length > 0) {
                const currentArticleIds = [];
                for (let j = 0; j < articlesTemp.length; j++) {
                    const artData = articlesTemp[j];
                    if (!hasArticleContent(artData)) continue;

                    try {
                        artData.contentTitle = artData.title || artData.contentTitle || 'ללא כותרת';
                        artData.section = artData.section || '';

                        // ✅ התיקון: שומרים את מה שהוקלד (אות או מספר) כטקסט, בלי המרה ובלי ברירת מחדל 1
                        artData.startPage = String(artData.startPage ?? artData.page ?? '').trim();

                        artData.volume = savedVolume._id;
                        artData.series = savedSeries._id;

                        if (!artData.createdBy) {
                            artData.createdBy = null;
                        }

                        artData.serialNumber = (currentArticleIds.length + 1).toString();

                        if (!artData.linkedArticleId || artData.linkedArticleId === "") {
                            artData.linkedArticleId = null;
                        }

                        artData.note = artData.note || '';

                        let savedArticle;
                        const articleId = artData._id || artData.id;
                        if (articleId && articleId.length === 24) {
                            savedArticle = await Article.findByIdAndUpdate(articleId, artData, { new: true });
                        } else {
                            delete artData._id;
                            delete artData.id;
                            savedArticle = await Article.create(artData);
                        }
                        currentArticleIds.push(savedArticle._id);
                    } catch (artError) {
                        console.error(`שגיאה בשמירת מאמר בגליון ${i + 1}:`, artError.message);
                        throw new Error(`שגיאה בשמירת מאמר בגליון ${i + 1}: ${artError.message}`);
                    }
                }
                await Volume.findByIdAndUpdate(savedVolume._id, { articles: currentArticleIds });
            }
        }

        await Series.findByIdAndUpdate(savedSeries._id, { volumes: currentVolumeIds });

        res.status(200).json({ status: 'success', data: { series: savedSeries } });
    } catch (error) {
        console.error('שגיאה ב-createSeries:', error);
        res.status(500).json({
            status: 'fail',
            message: error.message || 'שגיאה בעיבוד הנתונים'
        });
    }
});

// עדכון סדרה
exports.updateSeries = catchAsync(async (req, res) => {
    const series = await Series.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    }).populate('volumes');

    res.status(200).json({ status: 'success', data: { series } });
});

// פונקציית עזר לחילוץ ה-Public ID מתוך הקישור של Cloudinary
const getPublicIdFromUrl = (url) => {
    if (!url) return null;
    try {
        const parts = url.split('/');
        const uploadIndex = parts.indexOf('upload');
        if (uploadIndex === -1) return null;

        const publicIdWithExtension = parts.slice(uploadIndex + 2).join('/');
        return publicIdWithExtension.split('.')[0];
    } catch (err) {
        return null;
    }
};

// מחיקת סדרה והקבצים שלה מהענן
exports.deleteSeries = catchAsync(async (req, res) => {
    const series = await Series.findById(req.params.id);
    if (!series) return res.status(404).json({ status: 'fail', message: 'לא נמצא' });

    const volumes = await Volume.find({ series: series._id });

    for (const vol of volumes) {
        if (vol.pdfPath) {
            const pdfPublicId = getPublicIdFromUrl(vol.pdfPath);
            if (pdfPublicId) {
                await cloudinary.uploader.destroy(pdfPublicId, { resource_type: 'raw' }).catch(err => {
                    console.error(`שגיאה במחיקת PDF מהענן: ${pdfPublicId}`, err);
                });
            }
        }
    }

    if (series.coverImage) {
        const coverPublicId = getPublicIdFromUrl(series.coverImage);
        if (coverPublicId) {
            await cloudinary.uploader.destroy(coverPublicId);
        }
    }

    const volumeIds = volumes.map(v => v._id);
    await Article.deleteMany({ volume: { $in: volumeIds } });
    await Volume.deleteMany({ series: series._id });
    await series.deleteOne();

    res.status(204).json({ status: 'success', data: null });
});
