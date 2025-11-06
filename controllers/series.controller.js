// controllers/series.controller.js
const Series = require('../models/series.model');
const { catchasync } = require('../utils/error.handler');

// GET /api/series
const getAllSeries = catchasync(async (req, res) => {
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
const getSeriesBySlug = catchasync(async (req, res) => {
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
const createSeries = catchasync(async (req, res) => {
  const { error } = Series.validateCreate(req.body);
  if (error) return res.status(400).json({ status: 'fail', message: error.details[0].message });

  const series = await Series.create(req.body);

  res.status(201).json({
    status: 'success',
    data: { series }
  });
});

// PATCH /api/series/:id
const updateSeries = catchasync(async (req, res) => {
  const { error } = Series.validateUpdate(req.body);
  if (error) return res.status(400).json({ status: 'fail', message: error.details[0].message });

  const series = await Series.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!series) {
    return res.status(404).json({ status: 'fail', message: 'סדרה לא נמצאה' });
  }

  res.status(200).json({
    status: 'success',
    data: { series }
  });
});

// DELETE /api/series/:id
const deleteSeries = catchasync(async (req, res) => {
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