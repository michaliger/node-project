const mongoose = require('mongoose');
const Joi = require('joi');

const volumeSchema = new mongoose.Schema({
  volumeNumber: { type: Number, min: 1 },
  title: { type: String, trim: true },
  mainTopic: { type: String, trim: true, default: null },
  publicationYear: { type: String, default: null },
  publicationMonth: { type: String, default: null },
  occasion: { type: String, trim: true, default: null },
  volumeEditor: { type: String, trim: true, default: null },
  pdfPath: { type: String, default: null },
  // מערך של ID של מאמרים
  articles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subtitle'
  }],
  series: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Series',
    required: true
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// --- וולידציה עם Joi ---
const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/, 'ObjectId');

const volumeCreateSchema = Joi.object({
  volumeNumber: Joi.number().min(1).optional(),
  title: Joi.string().trim().allow('', null),
  mainTopic: Joi.string().trim().allow('', null),
  publicationYear: Joi.string().allow('', null),
  publicationMonth: Joi.string().allow('', null),
  occasion: Joi.string().trim().allow('', null),
  volumeEditor: Joi.string().trim().allow('', null),
  series: objectId.required(),
  createdBy: objectId.optional(),
  articles: Joi.array().items(objectId).default([])
});

// וולידציה עבור עדכון (PATCH)
const volumeUpdateSchema = Joi.object({
  volumeNumber: Joi.number().min(1).optional(),
  title: Joi.string().trim().allow('', null).optional(),
  mainTopic: Joi.string().trim().allow('', null).optional(),
  publicationYear: Joi.string().allow('', null).optional(),
  publicationMonth: Joi.string().allow('', null).optional(),
  occasion: Joi.string().trim().allow('', null).optional(),
  volumeEditor: Joi.string().trim().allow('', null).optional(),
  series: objectId.optional(),
  articles: Joi.array().items(objectId).optional()
});

volumeSchema.statics.validateCreate = (obj) => volumeCreateSchema.validate(obj, { abortEarly: false, stripUnknown: true });
volumeSchema.statics.validateUpdate = (obj) => volumeUpdateSchema.validate(obj, { abortEarly: false, stripUnknown: true });

// --- Hooks & Virtuals ---

volumeSchema.virtual('fullTitle').get(function () {
  return `גליון ${this.volumeNumber} - ${this.title || ''}`.trim();
});

// עדכון הסדרה אוטומטית בעת יצירת גליון
volumeSchema.pre('save', async function (next) {
  if (this.isNew) {
    await mongoose.model('Series').findByIdAndUpdate(
      this.series,
      { $addToSet: { volumes: this._id } }
    );
  }
  next();
});

const updateSeriesYears = async function (doc) {
  if (doc.series) {
    const volumes = await mongoose.model('Volume').find({ series: doc.series });
    const years = [...new Set(volumes.map(v => v.publicationYear).filter(y => y))].sort();
    await mongoose.model('Series').findByIdAndUpdate(doc.series, {
      publicationYears: years
    });
  }
};

volumeSchema.post('save', updateSeriesYears);

volumeSchema.post('deleteOne', { document: true, query: false }, async function (doc) {
    await updateSeriesYears(doc);
});

volumeSchema.post('findOneAndDelete', async function (doc) {
    if (doc) await updateSeriesYears(doc);
});

const Volume = mongoose.model('Volume', volumeSchema);
module.exports = Volume;