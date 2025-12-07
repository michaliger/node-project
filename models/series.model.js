const mongoose = require('mongoose');
const Joi = require('joi');

// -----------------------------
// 1. סכמה של Mongoose
// -----------------------------
const topicSchema = new mongoose.Schema({
  topicNumber: { type: Number, required: true },
  topicTitle: { type: String, trim: true, required: true },
  pageStart: { type: Number },
  pageEnd: { type: Number }
}, { _id: false });

const volumeSchema = new mongoose.Schema({
  volumeNumber: { type: Number, required: true },
  letter: { type: String, trim: true, maxlength: 1 },
  title: { type: String, trim: true, required: true },
  publicationYear: { type: Number },
  mainTopic: { type: String, trim: true },
  topics: [topicSchema]
}, { _id: true }); // כאן _id: true כדי שיהיה ID לכל כרך

const seriesSchema = new mongoose.Schema({
  prefixName: { type: String, trim: true, default: null }, // מתוך רשימה
  fileName: { type: String, required: true, unique: true, trim: true, lowercase: true },
  identifierName: { type: String, trim: true, default: null }, // חובה במקרה של כפילות
  author: { type: String, trim: true }, // י"ל ע"י או עורכים
  totalVolumes: { type: Number, default: 0 }, // ממולא אוטומטית לפי כרכים
  volumes: [volumeSchema], // אופציה ללא סוף להוספת כרכים
  volumeIDs: [{ type: mongoose.Schema.Types.ObjectId }], // השדה החדש – IDs של הכרכים
  publicationPlace: { type: String, default: 'ישראל', trim: true }, // אוטומטי
  publicationYears: { type: [Number], default: [] }, // ממולא לפי הכרכים
  sector: { type: String, trim: true, default: null }, // מתוך רשימה
  dataCompleteness: { type: String, trim: true, default: '' }, // שלמות המאגר
  missingVolumesList: { type: String, trim: true, default: '' }, // רשימת כרכים חסרים
  userNotes: { type: String, trim: true, default: '' }, // הערות למשתמש
  adminNotes: { type: String, trim: true, default: '' }, // הערות למערכת
  fileDescription: { type: String, trim: true, default: '' }, // תאור הקובץ
  coverImage: { type: String, default: 'default-series.jpg' }, // תמונת שער
  enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // מי שהכניס
  catalogStatus: { type: String, enum: ['חלקי', 'שלם'], default: 'חלקי' }, // מצב הקיטלוג
  msID: { type: String, trim: true, default: null }, // מ"ס אוטומטי
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// -----------------------------
// 2. אינדקסים
// -----------------------------
seriesSchema.index({ fileName: 1 }, { unique: true });
seriesSchema.index({ sector: 1, catalogStatus: 1 });

// -----------------------------
// 3. Virtuals
// -----------------------------
seriesSchema.virtual('volumeCount').get(function() {
  return this.volumes ? this.volumes.length : 0;
});

// -----------------------------
// 4. Hooks
// -----------------------------
seriesSchema.pre('save', function(next) {
  // עדכון totalVolumes אוטומטי לפי מספר הכרכים
  this.totalVolumes = this.volumes.length;

  // עדכון publicationYears לפי הכרכים
  const years = this.volumes
    .map(v => v.publicationYear)
    .filter(y => y != null)
    .sort((a, b) => a - b);
  this.publicationYears = [...new Set(years)];

  // עדכון volumeIDs לפי הכרכים
  this.volumeIDs = this.volumes.map(v => v._id);

  next();
});

// -----------------------------
// 5. Joi Validation
// -----------------------------
const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/, 'ObjectId');

const topicJoiSchema = Joi.object({
  topicNumber: Joi.number().integer().required(),
  topicTitle: Joi.string().required(),
  pageStart: Joi.number().integer().optional(),
  pageEnd: Joi.number().integer().optional()
});

const volumeJoiSchema = Joi.object({
  volumeNumber: Joi.number().integer().required(),
  letter: Joi.string().max(1).optional(),
  title: Joi.string().required(),
  publicationYear: Joi.number().integer().optional(),
  mainTopic: Joi.string().optional(),
  topics: Joi.array().items(topicJoiSchema).default([])
});

const seriesCreateSchema = Joi.object({
  prefixName: Joi.string().optional().allow(null, ''),
  fileName: Joi.string().required(),
  identifierName: Joi.string().optional().allow(null, ''),
  author: Joi.string().optional(),
  totalVolumes: Joi.number().integer().optional(),
  volumes: Joi.array().items(volumeJoiSchema).default([]),
  volumeIDs: Joi.array().items(objectId).optional(),
  publicationPlace: Joi.string().optional(),
  publicationYears: Joi.array().items(Joi.number().integer()).default([]),
  sector: Joi.string().optional(),
  dataCompleteness: Joi.string().optional(),
  missingVolumesList: Joi.string().optional(),
  userNotes: Joi.string().optional(),
  adminNotes: Joi.string().optional(),
  fileDescription: Joi.string().optional(),
  coverImage: Joi.string().optional(),
  enteredBy: objectId.required(),
  catalogStatus: Joi.string().valid('חלקי', 'שלם').optional(),
  msID: Joi.string().optional()
});

seriesSchema.statics.validateCreate = obj =>
  seriesCreateSchema.validate(obj, { abortEarly: false, stripUnknown: true });

seriesSchema.statics.validateUpdate = obj =>
  seriesCreateSchema.fork(Object.keys(seriesCreateSchema.describe().keys), schema => schema.optional())
    .validate(obj, { abortEarly: false, stripUnknown: true });

// -----------------------------
// 6. Export
// -----------------------------
const Series = mongoose.model('Series', seriesSchema);
module.exports = Series;