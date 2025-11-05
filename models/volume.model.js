const mongoose = require('mongoose');
const Joi = require('joi');

// -----------------------------
// 1. פונקציה ליצירת fileName אוטומטי (ל-URL)
// -----------------------------
const createSlug = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')                  // תומך בעברית (א, ב, ג...)
    .replace(/[\u0300-\u036f]/g, '')   // מסיר סימני ניקוד
    .replace(/[^א-תa-z0-9]+/g, '-')     // מחליף רווחים וסימנים ב-
    .replace(/^-+|-+$/g, '')           // מסיר - מההתחלה והסוף
    .trim();
};

// -----------------------------
// 2. סכמה של Volume
// -----------------------------
const volumeSchema = new mongoose.Schema({
  // מספר כרך
  volumeNumber: {
    type: Number,
    required: true,
    min: 1
  },

  // אות (א, ב, ג...) – אופציונלי
  letter: {
    type: String,
    trim: true,
    uppercase: true,
    maxlength: 1,
    default: null
  },

  // שם הכרך
  title: {
    type: String,
    required: true,
    trim: true
  },

  // נושא ראשי
  mainTopic: {
    type: String,
    trim: true,
    default: null
  },

  // חודש יציאה
  publicationMonth: {
    type: Number,
    min: 1,
    max: 12,
    default: null
  },

  // שנת יציאה
  publicationYear: {
    type: Number,
    min: 1000,
    max: new Date().getFullYear() + 10,
    default: null
  },

  // לרגל / לכבוד
  occasion: {
    type: String,
    trim: true,
    default: null
  },

  // כותרות משנה – מקושרות למודל Subtitle
  subtitles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subtitle',
    default: []
  }],

  // מספר עמודים
  pages: {
    type: Number,
    min: 1,
    default: null
  },

  // גובה בס"מ
  heightCm: {
    type: Number,
    min: 1,
    max: 100,
    default: null
  },

  // סוג כריכה
  coverType: {
    type: String,
    trim: true,
    enum: ['קשה', 'רכה', 'עור', 'כריכה רכה', 'כריכה קשה', 'אחר'],
    default: null
  },

  // מקור
  source: {
    type: String,
    trim: true,
    default: null
  },

  // הערות
  notes: {
    type: String,
    trim: true,
    default: null
  },

  // מספר סידורי (קוד פנימי ייחודי)
  serialId: {
    type: String,
    trim: true,
    unique: true,
    sparse: true,
    default: null
  },

  // שם קובץ ל-URL (ייחודי, אוטומטי)
  fileName: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },

  // סדרה
  series: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Series',
    required: true
  },

  // זמין?
  isAvailable: {
    type: Boolean,
    default: true
  },

  // תמונת כריכה
  coverImage: {
    type: String,
    trim: true,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// -----------------------------
// 3. אינדקסים
// -----------------------------
volumeSchema.index({ fileName: 1 }, { unique: true });
volumeSchema.index({ series: 1, volumeNumber: 1 }, { unique: true });
volumeSchema.index({ serialId: 1 }, { unique: true, sparse: true });
volumeSchema.index({ publicationYear: 1, publicationMonth: 1 });
volumeSchema.index({ mainTopic: 1 });

// -----------------------------
// 4. Virtual – שם מלא להצגה
// -----------------------------
volumeSchema.virtual('fullTitle').get(function () {
  let title = `כרך ${this.volumeNumber}`;
  if (this.letter) title += `${this.letter}`;
  title += `: ${this.title}`;
  return title;
});

// -----------------------------
// 5. Pre-save: יצירת fileName אוטומטי + עדכון סדרה
// -----------------------------
volumeSchema.pre('save', async function (next) {
  try {
    const Series = mongoose.model('Series');
    const Subtitle = mongoose.model('Subtitle');

    // 1. יצירת fileName אוטומטי אם לא קיים
    if (!this.fileName || this.isModified('title') || this.isModified('volumeNumber')) {
      let base = createSlug(this.title);
      if (this.volumeNumber) base += `-${this.volumeNumber}`;
      if (this.letter) base += `-${this.letter.toLowerCase()}`;

      // וידוא ייחודיות
      let slug = base;
      let counter = 1;
      while (await mongoose.model('Volume').countDocuments({ fileName: slug, _id: { $ne: this._id } })) {
        slug = `${base}-${counter}`;
        counter++;
      }
      this.fileName = slug;
    }

    // 2. וידוא שכל subtitle קיים
    if (this.subtitles && this.subtitles.length > 0) {
      const existing = await Subtitle.countDocuments({ _id: { $in: this.subtitles } });
      if (existing !== this.subtitles.length) {
        return next(new Error('אחת או יותר מהכותרות המשנה לא קיימות'));
      }
    }

    // 3. עדכון הסדרה
    if (this.isNew || this.isModified('series')) {
      await Series.findByIdAndUpdate(
        this.series,
        { $addToSet: { volumes: this._id } },
        { new: true }
      );
    }

    next();
  } catch (err) {
    next(err);
  }
});

// -----------------------------
// 6. Post-remove: הסרה מהסדרה
// -----------------------------
volumeSchema.post('remove', async function (doc, next) {
  try {
    const Series = mongoose.model('Series');
    await Series.findByIdAndUpdate(
      doc.series,
      { $pull: { volumes: doc._id } }
    );
    next();
  } catch (err) {
    next(err);
  }
});

// -----------------------------
// 7. וולידציה עם Joi
// -----------------------------
const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/, 'ObjectId');

const volumeCreateSchema = Joi.object({
  volumeNumber: Joi.number().integer().min(1).required(),
  letter: Joi.string().trim().uppercase().max(1).allow('', null),
  title: Joi.string().trim().required(),
  mainTopic: Joi.string().trim().allow('', null),
  publicationMonth: Joi.number().integer().min(1).max(12).allow(null),
  publicationYear: Joi.number().integer().min(1000).max(new Date().getFullYear() + 10).allow(null),
  occasion: Joi.string().trim().allow('', null),
  subtitles: Joi.array().items(objectId).default([]),
  pages: Joi.number().integer().min(1).allow(null),
  heightCm: Joi.number().min(1).max(100).allow(null),
  coverType: Joi.string().trim().valid('קשה', 'רכה', 'עור', 'כריכה רכה', 'כריכה קשה', 'אחר').allow(null),
  source: Joi.string().trim().allow('', null),
  notes: Joi.string().trim().allow('', null),
  serialId: Joi.string().trim().allow('', null),
  fileName: Joi.string().trim().lowercase().optional(), // אוטומטי – לא חייב לשלוח
  series: objectId.required(),
  isAvailable: Joi.boolean().default(true),
  coverImage: Joi.string().trim().uri().allow('', null)
});

const volumeUpdateSchema = volumeCreateSchema.fork(
  Object.keys(volumeCreateSchema.describe().keys),
  schema => schema.optional()
).fork(['fileName', 'series'], schema => schema.forbidden());

volumeSchema.statics.validateCreate = (obj) =>
  volumeCreateSchema.validate(obj, { abortEarly: false, stripUnknown: true });

volumeSchema.statics.validateUpdate = (obj) =>
  volumeUpdateSchema.validate(obj, { abortEarly: false, stripUnknown: true });

// -----------------------------
// 8. ייצוא
// -----------------------------
const Volume = mongoose.model('Volume', volumeSchema);
module.exports = Volume;