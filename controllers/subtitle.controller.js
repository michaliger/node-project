// controllers/subtitle.controller.js
const Subtitle = require('../models/subtitle.model');
const { catchasync } = require('../utils/error.handler');

const getallsubtitles = catchasync(async (req, res) => {
  const subtitles = await Subtitle.find()
    .select('serialNumber contentTitle category role authorFullName startPage')
    .sort({ serialNumber: 1 });

  res.status(200).json({
    status: 'success',
    results: subtitles.length,
    data: { subtitles }
  });
});

const getsubtitle = catchasync(async (req, res) => {
  const subtitle = await Subtitle.findById(req.params.id)
    .populate('additionalAuthor', 'authorFullName')
    .populate('continuationInNextVolume', 'volumeNumber title fileName');

  if (!subtitle) {
    return res.status(404).json({ status: 'fail', message: 'כותרת משנה לא נמצאה' });
  }

  res.status(200).json({
    status: 'success',
    data: { subtitle }
  });
});

const createsubtitle = catchasync(async (req, res) => {
  const { error } = Subtitle.validateCreate(req.body);
  if (error) return res.status(400).json({ status: 'fail', message: error.details[0].message });

  const subtitle = await Subtitle.create(req.body);

  res.status(201).json({
    status: 'success',
    data: { subtitle }
  });
});

const updatesubtitle = catchasync(async (req, res) => {
  const { error } = Subtitle.validateUpdate(req.body);
  if (error) return res.status(400).json({ status: 'fail', message: error.details[0].message });

  const subtitle = await Subtitle.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!subtitle) {
    return res.status(404).json({ status: 'fail', message: 'כותרת משנה לא נמצאה' });
  }

  res.status(200).json({
    status: 'success',
    data: { subtitle }
  });
});

const deletesubtitle = catchasync(async (req, res) => {
  const subtitle = await Subtitle.findByIdAndDelete(req.params.id);
  if (!subtitle) {
    return res.status(404).json({ status: 'fail', message: 'כותרת משנה לא נמצאה' });
  }

  const Volume = require('../models/Volume');
  await Volume.updateMany(
    { subtitles: req.params.id },
    { $pull: { subtitles: req.params.id } }
  );

  res.status(204).json({ status: 'success', data: null });
});

module.exports = {
  getallsubtitles,
  getsubtitle,
  createsubtitle,
  updatesubtitle,
  deletesubtitle
};
