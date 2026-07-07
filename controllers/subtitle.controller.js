// controllers/subtitle.controller.js
const Subtitle = require('../models/subtitle.model');
const Volume = require('../models/volume.model');
const catchAsync = require('../utils/catchAsync');

const getallsubtitles = catchAsync(async (req, res) => {
  const subtitles = await Subtitle.find()
    .select('serialNumber contentTitle category role authorFullName startPage')
    .sort({ serialNumber: 1 });

  res.status(200).json({
    status: 'success',
    results: subtitles.length,
    data: { subtitles }
  });
});

const getsubtitle = catchAsync(async (req, res) => {
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

const createsubtitle = catchAsync(async (req, res) => {
  const { error } = Subtitle.validateCreate(req.body);
  if (error) return res.status(400).json({ status: 'fail', message: error.details[0].message });

  const subtitle = await Subtitle.create(req.body);

  res.status(201).json({
    status: 'success',
    data: { subtitle }
  });
});

const updatesubtitle = catchAsync(async (req, res) => {
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

const deletesubtitle = catchAsync(async (req, res) => {
  // 1. קודם כל ננסה למחוק את המאמר עצמו
  const subtitle = await Subtitle.findByIdAndDelete(req.params.id);
  
  if (!subtitle) {
    return res.status(404).json({ status: 'fail', message: 'כותרת משנה לא נמצאה' });
  }

  // 2. לאחר מכן ננקה את ה-ID מהמערך בתוך ה-Volume
  // חשוב לוודא ששם השדה הוא אכן 'articles' כפי שמופיע במודל Volume
  await Volume.updateMany(
    { articles: req.params.id },
    { $pull: { articles: req.params.id } }
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