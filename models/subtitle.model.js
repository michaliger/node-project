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

  // תואר (רב, ד"ר, הרבנית...)
  titlePrefix: {
    type: String,
    trim: true,
    default: null
  },

  // שם משפחה
  lastName: {
    type: String,
    trim: true,
    default: null
  },

  // שם פרטי
  firstName: {
    type: String,
    trim: true,
    default: null
  },

  // תפקיד (מחבר, מפרש, עורך, מתרגם...)
  role: {
    type: String,
    trim: true,
    enum: ['מחבר', 'מפרש', 'עורך', 'מתרגם', 'מביא לדפוס', 'אחר'],
    default: 'מחבר'
  },

  // קטגוריה (פירוש, הקדמה, נספח, מבוא...)
  category: {
    type: String,
    trim: true,
    enum: ['פירוש', 'הקדמה', 'נספח', 'מבוא', 'חלק', 'תוספת', 'אחר'],
    default: 'אחר'
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

  // קישור להמשך בכרך הבא (אם יש)
  continuationInNextVolume: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Volume',
    default: null
  },

  // הערות
  notes: {
    type: String,
    trim: true,
    default: null
  },

  // מחבר נוסף (קישור לאותו מודל – אם יש שניים)
  additionalAuthor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subtitle', // כן! קישור לעצמו
    default: null
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
// subtitleSchema.index({ serialNumber: 1 }, { unique: true });
subtitleSchema.index({ contentTitle: 1, lastName: 1 });
subtitleSchema.index({ startPage: 1 });

// -----------------------------
// 3. Virtual – שם מלא של המחבר
// -----------------------------
subtitleSchema.virtual('authorFullName').get(function () {
  let name = '';
  if (this.titlePrefix) name += `${this.titlePrefix} `;
  if (this.firstName) name += `${this.firstName} `;
  if (this.lastName) name += `${this.lastName}`;
  return name.trim() || 'ללא שם';
});

// -----------------------------
// 4. Virtual – תיאור קצר
// -----------------------------
subtitleSchema.virtual('shortDescription').get(function () {
  return `${this.category}: ${this.contentTitle} מאת ${this.authorFullName}`;
});

// -----------------------------
// 5. וולידציה עם Joi
// -----------------------------
const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/, 'ObjectId');

const subtitleCreateSchema = Joi.object({
  serialNumber: Joi.string().trim().uppercase().required(),
  titlePrefix: Joi.string().trim().allow('', null),
  lastName: Joi.string().trim().allow('', null),
  firstName: Joi.string().trim().allow('', null),
  role: Joi.string().trim().valid('מחבר', 'מפרש', 'עורך', 'מתרגם', 'מביא לדפוס', 'אחר').default('מחבר'),
  category: Joi.string().trim().valid('פירוש', 'הקדמה', 'נספח', 'מבוא', 'חלק', 'תוספת', 'אחר').default('אחר'),
  contentTitle: Joi.string().trim().required(),
  source: Joi.string().trim().allow('', null),
  startPage: Joi.number().integer().min(1).allow(null),
  continuationInNextVolume: objectId.allow(null),
  notes: Joi.string().trim().allow('', null),
  additionalAuthor: objectId.allow(null)
});

const subtitleUpdateSchema = subtitleCreateSchema.fork(
  Object.keys(subtitleCreateSchema.describe().keys),
  schema => schema.optional()
);

subtitleSchema.statics.validateCreate = (obj) =>
  subtitleCreateSchema.validate(obj, { abortEarly: false, stripUnknown: true });

subtitleSchema.statics.validateUpdate = (obj) =>
  subtitleUpdateSchema.validate(obj, { abortEarly: false, stripUnknown: true });

// -----------------------------
// 6. ייצוא
// -----------------------------
// עדכון אוטומטי של מי ערך
subtitleSchema.pre('save', function(next) {
  if (this.isNew || this.isModified()) {
    this.updatedBy = this.createdBy || null;
  }
  next();
});

const Subtitle = mongoose.model('Subtitle', subtitleSchema);
module.exports = Subtitle;