const mongoose = require('mongoose');
const Joi = require('joi');

// -----------------------------
// 1. סכמה של Subtitle (כותרת משנה)
// -----------------------------
const subtitleSchema = new mongoose.Schema({
  // מספר סידורי (למשל: 001, 002 – ייחודי בתוך הכרך)
  serialNumber: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },

  // הכותרת של התוכן
  contentTitle: {
    type: String,
    required: true,
    trim: true
  },

  // על מקור (מאיפה לקוח התוכן)
  source: {
    type: String,
    trim: true,
    default: null
  },

  // עמוד בכרך (היכן מתחיל)
  startPage: {
    type: Number,
    min: 1,
    default: null
  },

  // נושא כללי
  generalTopic: {
    type: String,
    trim: true,
    default: ''
  },

  // קישור להמשך בכרך הבא (אם יש)
  continuationInNextVolume: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Volume',
    default: null
  },

  // הסבר בקישור
  linkedArticleId: {
    type: String,
    trim: true,
    enum: ['', 'בקורת', 'המשך', 'תגובה'],
    default: ''
  },

  // מחברים – מערך של אובייקטים
  authors: {
    type: [{
      titlePrefix: { type: String, trim: true, default: '' },      // תואר (רב, ד"ר, הרבנית...)
      firstName:   { type: String, trim: true, default: '' },      // שם פרטי
      lastName:    { type: String, trim: true, default: '' },      // שם משפחה
      role:        { type: String, trim: true, default: 'מחבר' }  // תפקיד (מחבר, מפרש, עורך, מתרגם...)
    }],
    default: []   // מערך ריק בהתחלה
  },

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

// -----------------------------
// 2. אינדקסים
// -----------------------------
subtitleSchema.index({ contentTitle: 1 });
subtitleSchema.index({ startPage: 1 });

// -----------------------------
// 3. Virtual – תצוגת מחברים
// -----------------------------
subtitleSchema.virtual('authorsDisplay').get(function () {
  if (this.authors.length === 0) return 'ללא מחבר';
  return this.authors
    .map(a => {
      let name = '';
      if (a.titlePrefix) name += `${a.titlePrefix} `;
      if (a.firstName) name += `${a.firstName} `;
      if (a.lastName) name += `${a.lastName}`;
      if (a.role && a.role !== 'מחבר') name += ` (${a.role})`;
      return name.trim();
    })
    .filter(n => n)
    .join(' ו-');
});

// -----------------------------
// 4. וולידציה עם Joi
// -----------------------------
const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/, 'ObjectId');

const subtitleCreateSchema = Joi.object({
  serialNumber: Joi.string().trim().uppercase().required(),
  contentTitle: Joi.string().trim().required(),
  source: Joi.string().trim().allow('', null),
  startPage: Joi.number().integer().min(1).allow(null),
  generalTopic: Joi.string().trim().allow(''),
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

const subtitleUpdateSchema = subtitleCreateSchema.fork(['createdBy'], schema => schema.optional());

subtitleSchema.statics.validateCreate = (obj) => subtitleCreateSchema.validate(obj, { abortEarly: false, stripUnknown: true });
subtitleSchema.statics.validateUpdate = (obj) => subtitleUpdateSchema.validate(obj, { abortEarly: false, stripUnknown: true });

// -----------------------------
// 5. pre-save – עדכון מי ערך
// -----------------------------
subtitleSchema.pre('save', function (next) {
  this.updatedBy = this.createdBy || null;
  next();
});

// -----------------------------
// 6. ייצוא
// -----------------------------
const Subtitle = mongoose.model('Subtitle', subtitleSchema);
module.exports = Subtitle;