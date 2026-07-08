// controllers/series.controller.js
const Series = require('../models/series.model');
const Volume = require('../models/volume.model');
const Article = require('../models/subtitle.model');
const catchAsync = require('../utils/catchAsync');

// פונקציה משופרת: בודקת אם יש ערך כלשהו במאמר (לא משנה איזה שדה)
const hasArticleContent = (art) => {
    if (!art) return false;
    
    // מעבר על כל המפתחות של האובייקט (חוץ משדות אוטומטיים/מערכים)
    return Object.entries(art).some(([key, value]) => {
        if (key === '_id' || key === 'id' || key === 'volume' || key === 'series') return false;
        
        // אם זה מחרוזת טקסט - בודק שאינה ריקה
        if (typeof value === 'string' && value.trim() !== '') return true;
        
        // אם זה מספר (למשל עמוד)
        if (typeof value === 'number' && !isNaN(value)) return true;
        
        // אם מדובר במערך המחברים
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
    const seriesData = JSON.parse(req.body.seriesData);
    const volumesData = req.body.volumes ? JSON.parse(req.body.volumes) : [];

    // שמירת הקישור הישיר מהענן עבור תמונת הכריכה
    const coverFile = req.files && req.files.find(f => f.fieldname === 'coverImage');
    if (coverFile) {
        seriesData.coverImage = coverFile.path; 
    }

    let savedSeries;

    if (seriesData._id) {
        savedSeries = await Series.findByIdAndUpdate(seriesData._id, seriesData, { new: true });
        const currentVolumeIds = [];

        for (let i = 0; i < volumesData.length; i++) {
            const volData = volumesData[i];
            
            // שמירת הקישור הישיר מהענן עבור קובץ ה-PDF
            const pdfFile = req.files && req.files.find(f => f.fieldname === `pdfFile_${i}`);
            if (pdfFile) {
                volData.pdfPath = pdfFile.path;
            }

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

                    artData.contentTitle = artData.title || artData.contentTitle || 'ללא כותרת';
                    artData.section = artData.section || ''; 
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
            
            // שמירת הקישור הישיר מהענן עבור קובץ ה-PDF בסדרה חדשה
            const pdfFile = req.files && req.files.find(f => f.fieldname === `pdfFile_${i}`);
            if (pdfFile) {
                volData.pdfPath = pdfFile.path;
            }

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
                        contentTitle: art.title || art.contentTitle || 'ללא כותרת',
                        section: art.section || '', 
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

// מחיקת סדרה
exports.deleteSeries = catchAsync(async (req, res) => {
    const series = await Series.findById(req.params.id);
    if (!series) return res.status(404).json({ status: 'fail', message: 'לא נמצא' });

    const volumeIds = await Volume.find({ series: series._id }).distinct('_id');

    await Article.deleteMany({ volume: { $in: volumeIds } });
    await Volume.deleteMany({ series: series._id });
    await series.deleteOne();

    res.status(204).json({ status: 'success', data: null });
});