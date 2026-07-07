// controllers/volume.controller.js
const Volume = require('../models/volume.model');
const Subtitle = require('../models/subtitle.model');
const Series = require('../models/series.model');
const catchAsync = require('../utils/catchAsync');

const getallvolumes = catchAsync(async (req, res) => {
  const volumes = await Volume.find()
    .select('volumeNumber letter title fileName publicationYear series coverImage')
    .populate('series', 'name fileName')
    .sort({ 'series.name': 1, volumeNumber: 1 });

  res.status(200).json({
    status: 'success',
    results: volumes.length,
    data: { volumes }
  });
});

const getvolumebyslug = catchAsync(async (req, res) => {
  const volume = await Volume.findOne({ fileName: req.params.fileName })
    .populate('series', 'name fileName')
    .populate({
      path: 'subtitles',
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

  // מחיקת המאמרים המשויכים
  await Subtitle.deleteMany({ volume: req.params.id });
  
  // הסרת הקשר מהסדרה
  await Series.findByIdAndUpdate(volume.series, {
    $pull: { volumes: volume._id }
  });

  // מחיקת הכרך
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