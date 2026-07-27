const mongoose = require('mongoose');
const Joi = require('joi');

const subtitleSchema = new mongoose.Schema({
  serialNumber: {
    type: String,
    required: true,
    trim: true
  },
  section: {
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
  // ✅ הערה אחת בלבד - ללא linkExplanation
  note: {
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
  // קישור ישיר לסדרה
  series: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Series'
  },
  continuationInNextVolume: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Volume',
    default: null
  },
  // קישור למאמר אחר
  linkedArticleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subtitle',
    default: null
  },
  authors: [{
    titlePrefix: { type: String, trim: true, default: '' },
    firstName: { type: String, trim: true, default: '' },
    lastName: { type: String, trim: true, default: '' },
    role: { type: String, trim: true, default: 'מחבר' }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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
subtitleSchema.index({ volume: 1 });
subtitleSchema.index({ series: 1 });

subtitleSchema.virtual('authorsDisplay').get(function () {
  if (!this.authors || this.authors.length === 0) return 'ללא מחבר';
  return this.authors
    .map(a => `${a.titlePrefix || ''} ${a.firstName || ''} ${a.lastName || ''} ${a.role !== 'מחבר' ? '(' + a.role + ')' : ''}`.trim())
    .join(' ו-');
});

// --- Joi Validation ---
const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/, 'ObjectId');

const subtitleCreateSchema = Joi.object({
  serialNumber: Joi.string().trim().required(),
  section: Joi.string().trim().allow(''),
  contentTitle: Joi.string().trim().required(),
  source: Joi.string().trim().allow('', null),
  startPage: Joi.number().integer().min(1).allow(null),
  generalTopic: Joi.string().trim().allow(''),
  note: Joi.string().trim().allow(''),
  volume: objectId.required(),
  series: objectId.allow(null),
  continuationInNextVolume: objectId.allow(null),
  linkedArticleId: objectId.allow(null),
  authors: Joi.array().items(
    Joi.object({
      titlePrefix: Joi.string().trim().allow(''),
      firstName: Joi.string().trim().allow(''),
      lastName: Joi.string().trim().allow(''),
      role: Joi.string().trim().allow('')
    })
  ).default([]),
  createdBy: objectId.optional()
});

const subtitleUpdateSchema = Joi.object({
  serialNumber: Joi.string().trim().optional(),
  section: Joi.string().trim().allow('').optional(),
  contentTitle: Joi.string().trim().optional(),
  source: Joi.string().trim().allow('', null).optional(),
  startPage: Joi.number().integer().min(1).allow(null).optional(),
  generalTopic: Joi.string().trim().allow('').optional(),
  note: Joi.string().trim().allow('').optional(),
  volume: objectId.optional(),
  series: objectId.allow(null).optional(),
  continuationInNextVolume: objectId.allow(null).optional(),
  linkedArticleId: objectId.allow(null).optional(),
  authors: Joi.array().items(
    Joi.object({
      titlePrefix: Joi.string().trim().allow('').optional(),
      firstName: Joi.string().trim().allow('').optional(),
      lastName: Joi.string().trim().allow('').optional(),
      role: Joi.string().trim().allow('').optional()
    })
  ).optional()
});

subtitleSchema.statics.validateCreate = (obj) => subtitleCreateSchema.validate(obj, { abortEarly: false, stripUnknown: true });
subtitleSchema.statics.validateUpdate = (obj) => subtitleUpdateSchema.validate(obj, { abortEarly: false, stripUnknown: true });

// --- Middleware ---
subtitleSchema.pre('save', function (next) {
  this.updatedBy = this.createdBy || null;
  next();
});

const Subtitle = mongoose.model('Subtitle', subtitleSchema);
module.exports = Subtitle;