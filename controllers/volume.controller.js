const Volume = require('../models/volume.model');
const Subtitle = require('../models/subtitle.model');
const Series = require('../models/series.model');
const catchAsync = require('../utils/catchAsync');
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: 'zqgbyjp9',
  api_key: '346468923129492',
  api_secret: 'dWQxubxrZUdtO16oGASqCSXmGdQ'
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

const getallvolumes = catchAsync(async (req, res) => {
  const volumes = await Volume.find()
    .select('volumeNumber letter title fileName publicationYear volumeEditor series coverImage')
    .populate('series', 'name fileName')
    .sort({ 'series.name': 1, volumeNumber: 1 });

  res.status(200).json({
    status: 'success',
    results: volumes.length,
    data: { volumes }
  });
});

const getvolumebyslug = catchAsync(async (req, res) => {
  // תיקון: משנים את path מ-'subtitles' ל-'articles' כדי שיתאים לסכמה במודל
  const volume = await Volume.findOne({ fileName: req.params.fileName })
    .populate('series', 'name fileName')
    .populate({
      path: 'articles', 
      select: 'serialNumber contentTitle category role authorFullName startPage continuationInNextVolume',
      populate: [
        { path: 'additionalAuthor', select: 'authorFullName' },
        { path: 'continuationInNextVolume', select: 'volumeNumber title fileName' }
      ]
    });

  if (!volume) {
    return res.status(404).json({ status: 'fail', message: 'כרך לא נמצא' });
  }

  res.status(200).json({
    status: 'success',
    data: { volume }
  });
});

const createvolume = catchAsync(async (req, res) => {
  const { error } = Volume.validateCreate(req.body);
  if (error) return res.status(400).json({ status: 'fail', message: error.details[0].message });

  const volume = await Volume.create(req.body);

  res.status(201).json({
    status: 'success',
    data: { volume }
  });
});

const updatevolume = catchAsync(async (req, res) => {
  const { error } = Volume.validateUpdate(req.body);
  if (error) return res.status(400).json({ status: 'fail', message: error.details[0].message });

  const volume = await Volume.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!volume) {
    return res.status(404).json({ status: 'fail', message: 'כרך לא נמצא' });
  }

  res.status(200).json({
    status: 'success',
    data: { volume }
  });
});

const deletevolume = catchAsync(async (req, res) => {
  const volume = await Volume.findById(req.params.id);
  if (!volume) {
    return res.status(404).json({ status: 'fail', message: 'כרך לא נמצא' });
  }

  // 1. מחיקת קובץ ה-PDF של הגליון מהענן (במידה וקיים)
  if (volume.pdfPath) {
    const pdfPublicId = getPublicIdFromUrl(volume.pdfPath);
    if (pdfPublicId) {
      await cloudinary.uploader.destroy(pdfPublicId, { resource_type: 'raw' }).catch(err => {
        console.error(`שגיאה במחיקת PDF של גליון מהענן: ${pdfPublicId}`, err);
      });
    }
  }

  // 2. מחיקת המאמרים, עדכון הסדרה ומחיקת הגליון עצמו מה-DB
  await Subtitle.deleteMany({ volume: req.params.id });
  
  await Series.findByIdAndUpdate(volume.series, {
    $pull: { volumes: volume._id }
  });

  await volume.deleteOne();

  res.status(204).json({ status: 'success', data: null });
});
module.exports = {
  getallvolumes,
  getvolumebyslug,
  createvolume,
  updatevolume,
  deletevolume
};