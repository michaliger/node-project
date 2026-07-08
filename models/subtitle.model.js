const mongoose = require('mongoose');
const Joi = require('joi');

const subtitleSchema = new mongoose.Schema({
  serialNumber: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  section: { // <-- התווסף לסכמה
    type: String,
    trim: true,
    default: ''
  },
  contentTitle: {
    type: String,
    required: true,
    trim: true
  },
  source: {
    type: String,
    trim: true,
    default: null
  },
  startPage: {
    type: Number,
    min: 1,
    default: null
  },
  generalTopic: {
    type: String,
    trim: true,
    default: ''
  },
  // הקישור הקריטי לגליון האב
  volume: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Volume',
    required: true
  },
  continuationInNextVolume: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Volume',
    default: null
  },
  linkedArticleId: {
    type: String,
    trim: true,
    enum: ['', 'בקורת', 'המשך', 'תגובה'],
    default: ''
  },
  authors: [{
    titlePrefix: { type: String, trim: true, default: '' },
    firstName: { type: String, trim: true, default: '' },
    lastName: { type: String, trim: true, default: '' },
    role: { type: String, trim: true, default: 'מחבר' }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// --- אינדקסים ו-Virtuals ---
subtitleSchema.index({ contentTitle: 1 });
subtitleSchema.index({ volume: 1 }); // אינדקס חדש לחיפוש מהיר לפי גליון

subtitleSchema.virtual('authorsDisplay').get(function () {
  if (!this.authors || this.authors.length === 0) return 'ללא מחבר';
  return this.authors
    .map(a => `${a.titlePrefix || ''} ${a.firstName || ''} ${a.lastName || ''} ${a.role !== 'מחבר' ? '(' + a.role + ')' : ''}`.trim())
    .join(' ו-');
});

// --- Joi Validation ---
const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/, 'ObjectId');

const subtitleCreateSchema = Joi.object({
  serialNumber: Joi.string().trim().uppercase().required(),
  section: Joi.string().trim().allow(''), // <-- התווסף לוולידציה של Joi
  contentTitle: Joi.string().trim().required(),
  source: Joi.string().trim().allow('', null),
  startPage: Joi.number().integer().min(1).allow(null),
  generalTopic: Joi.string().trim().allow(''),
  volume: objectId.required(), // חובה בוולידציה
  continuationInNextVolume: objectId.allow(null),
  linkedArticleId: Joi.string().valid('', 'בקורת', 'המשך', 'תגובה').allow(''),
  authors: Joi.array().items(
    Joi.object({
      titlePrefix: Joi.string().trim().allow(''),
      firstName: Joi.string().trim().allow(''),
      lastName: Joi.string().trim().allow(''),
      role: Joi.string().trim().allow('')
    })
  ).default([]),
  createdBy: objectId.required()
});

subtitleSchema.statics.validateCreate = (obj) => subtitleCreateSchema.validate(obj, { abortEarly: false, stripUnknown: true });

// --- Middleware ---
subtitleSchema.pre('save', function (next) {
  this.updatedBy = this.createdBy || null;
  next();
});

const Subtitle = mongoose.model('Subtitle', subtitleSchema);
module.exports = Subtitle;