// controllers/series.controller.js
const Series = require('../models/series.model');
const catchAsync = require('../utils/catchAsync');

// GET /api/series
const getAllSeries = catchAsync(async (req, res) => {
  const series = await Series.find()
    .select('prefixName name fileName genre rarity volumeCount publicationYears')
    .sort({ name: 1 });

  res.status(200).json({
    status: 'success',
    results: series.length,
    data: { series }
  });
});

// GET /api/series/:fileName
const getSeriesBySlug = catchAsync(async (req, res) => {
  const series = await Series.findOne({ fileName: req.params.fileName })
    .populate({
      path: 'volumes',
      select: 'volumeNumber letter title fileName publicationYear mainTopic coverImage',
      populate: {
        path: 'subtitles',
        select: 'serialNumber contentTitle category role authorFullName startPage',
        populate: { path: 'additionalAuthor', select: 'authorFullName' }
      }
    });

  if (!series) {
    return res.status(404).json({ status: 'fail', message: 'סדרה לא נמצאה' });
  }

  res.status(200).json({
    status: 'success',
    data: { series }
  });
});
// POST /api/series
const createSeries = catchAsync(async (req, res) => {
  // 1. ולידציה
  const { error } = Series.validateCreate(req.body);
  if (error) {
    return res.status(400).json({
      status: 'fail',
      message: error.details[0].message
    });
  }

  // 2. הכנת הנתונים – כאן אנחנו מוודאים ש-coverImage תקין
  const data = {
    prefixName: req.body.prefixName?.trim() || null,
    fileName: req.body.fileName?.trim().toLowerCase(),
    details: req.body.details?.trim() || null,
    publicationPlace: req.body.publicationPlace?.trim() || null,
    genre: req.body.genre?.trim() || null,
    rarity: req.body.rarity?.trim() || null,
    notes: req.body.notes?.trim() || null,

    // הכי חשוב – תמונת הכריכה
    coverImage: req.body.coverImage && req.body.coverImage.trim() !== ''
      ? req.body.coverImage.trim()
      : 'default-series.jpg',

    // אם יש fileAlias
    fileAlias: req.body.fileAlias
      ? {
          value: req.body.fileAlias.value?.trim() || null,
          public: req.body.fileAlias.public === true
        }
      : { value: null, public: false },

    // רשימת כרכים (אם שלחו)
    volumes: Array.isArray(req.body.volumes) ? req.body.volumes : []
  };

  // 3. יצירת הסדרה
  const series = await Series.create(data);

  res.status(201).json({
    status: 'success',
    data: { series }
  });
});

// PATCH /api/series/:id
const updateSeries = catchAsync(async (req, res) => {
  // 1. ולידציה
  const { error } = Series.validateUpdate(req.body);
  if (error) {
    return res.status(400).json({
      status: 'fail',
      message: error.details[0].message
    });
  }

  // 2. הכנת הנתונים לעדכון (אותו דבר כמו ב-create)
  const data = {
    prefixName: req.body.prefixName?.trim() || undefined,
    fileName: req.body.fileName?.trim().toLowerCase(),
    details: req.body.details?.trim() || undefined,
    publicationPlace: req.body.publicationPlace?.trim() || undefined,
    genre: req.body.genre?.trim() || undefined,
    rarity: req.body.rarity?.trim() || undefined,
    notes: req.body.notes?.trim() || undefined,

    // תמונת כריכה – אם שלחו ריק → נחזיר לברירת מחדל
    coverImage:
      req.body.coverImage === null ||
      (typeof req.body.coverImage === 'string' && req.body.coverImage.trim() === '')
        ? 'default-series.jpg'
        : req.body.coverImage?.trim(),

    fileAlias: req.body.fileAlias
      ? {
          value: req.body.fileAlias.value?.trim() || null,
          public: req.body.fileAlias.public === true
        }
      : undefined
  };

  // מוסיפים רק שדות ששלחו (כדי לא למחוק דברים שלא נשלחו)
  const updateData = Object.fromEntries(
    Object.entries(data).filter(([_, value]) => value !== undefined)
  );

  // 3. עדכון
  const series = await Series.findByIdAndUpdate(
    req.params.id,
    updateData,
    {
      new: true,
      runValidators: true
    }
  );

  if (!series) {
    return res.status(404).json({
      status: 'fail',
      message: 'סדרה לא נמצאה'
    });
  }

  res.status(200).json({
    status: 'success',
    data: { series }
  });
});
// DELETE /api/series/:id
const deleteSeries = catchAsync(async (req, res) => {
  const series = await Series.findByIdAndDelete(req.params.id);
  if (!series) {
    return res.status(404).json({ status: 'fail', message: 'סדרה לא נמצאה' });
  }

  res.status(204).json({ status: 'success', data: null });
});

module.exports = {
  getAllSeries,
  getSeriesBySlug,
  createSeries,
  updateSeries,
  deleteSeries
};