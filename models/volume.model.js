const mongoose = require('mongoose');
const Joi = require('joi');

const volumeSchema = new mongoose.Schema({
  // מספר גליון
  volumeNumber: {
    type: Number,
    min: 1
  },

  // שנה (שדה ישן – נשאר אם את משתמשת בו)
  year: {
    type: String,
    trim: true,
    default: null
  },

  // חוברת (א, ב, ג...)
  letter: {
    type: String,
    trim: true,
    default: null
  },

  // שם גליון – השם הראשי והיחיד (במקום fileName)
  title: {
    type: String,
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
    type: String,
    default: null
  },

  // שנת יציאה – משמש לעדכון אוטומטי של publicationYears בסדרה
  publicationYear: {
    type: String,
    default: null
  },

  // י"ל לרגל
  occasion: {
    type: String,
    trim: true,
    default: null
  },

  // כותרות משנה
  subtitles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subtitle',
    default: []
  }],

  // גודל גליון
  volumeSize: {
    type: String,
    enum: ["", "גדול", "בינוני", "קטן"],
    default: ""
  },

  // סוג כריכה
  coverType: {
    type: String,
    trim: true,
    enum: ["", "קשה", "רכה"],
    default: ""
  },

  // סטטוס מקור
  source: {
    type: String,
    trim: true,
    default: null
  },

  // סטטוס קטלוג
  catalogStatus: {
    type: String,
    trim: true,
    default: ""
  },

  // סדרה
  series: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Series',
    required: true
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
// אינדקסים
// -----------------------------
volumeSchema.index({ series: 1, volumeNumber: 1 }, { unique: true });
volumeSchema.index({ series: 1, title: 1 }, { unique: true }); // ייחודיות שם גליון בתוך סדרה
volumeSchema.index({ serialId: 1 }, { unique: true, sparse: true });
volumeSchema.index({ publicationYear: 1, publicationMonth: 1 });
volumeSchema.index({ mainTopic: 1 });

// -----------------------------
// Virtual – שם מלא להצגה
// -----------------------------
volumeSchema.virtual('fullTitle').get(function () {
  let title = `כרך ${this.volumeNumber}`;
  if (this.letter) title += ` ${this.letter}`;
  if (this.title) title += ` - ${this.title}`;
  return title.trim();
});

// -----------------------------
// Pre-save: עדכון updatedBy + וידוא subtitles + הוספה לסדרה
// -----------------------------
volumeSchema.pre('save', async function (next) {
  try {
    // עדכון מי שעדכן
    this.updatedBy = this.createdBy || null;

    // וידוא שכל subtitle קיים
    if (this.subtitles && this.subtitles.length > 0) {
      const existing = await mongoose.model('Subtitle').countDocuments({ _id: { $in: this.subtitles } });
      if (existing !== this.subtitles.length) {
        return next(new Error('אחת או יותר מהכותרות המשנה לא קיימות'));
      }
    }

    // הוספה לסדרה אם זה כרך חדש
    if (this.isNew) {
      await mongoose.model('Series').findByIdAndUpdate(
        this.series,
        { $addToSet: { volumes: this._id } }
      );
    }

    next();
  } catch (err) {
    next(err);
  }
});

// -----------------------------
// Post-remove: הסרה מהסדרה
// -----------------------------
volumeSchema.post('remove', async function (doc, next) {
  try {
    await mongoose.model('Series').findByIdAndUpdate(
      doc.series,
      { $pull: { volumes: doc._id } }
    );
    next();
  } catch (err) {
    next(err);
  }
});

// עדכון אוטומטי של totalVolumes בסדרה כשמוסיפים/מוחקים כרך
volumeSchema.post('save', async function (doc) {
  if (doc.series) {
    const count = await this.constructor.countDocuments({ series: doc.series });
    await mongoose.model('Series').findByIdAndUpdate(doc.series, { totalVolumes: count });
  }
});

volumeSchema.post('remove', async function (doc) {
  if (doc.series) {
    const count = await this.constructor.countDocuments({ series: doc.series });
    await mongoose.model('Series').findByIdAndUpdate(doc.series, { totalVolumes: count });
  }
});

// -----------------------------
// עדכון אוטומטי של publicationYears בסדרה (שמירה + מחיקה)
// -----------------------------
volumeSchema.post('save', async function (doc, next) {
  try {
    if (doc.series) {
      const volumes = await this.constructor.find({ series: doc.series });
      const years = [...new Set(
        volumes
          .map(v => v.publicationYear)
          .filter(y => y != null)
      )].sort((a, b) => a - b);

      await mongoose.model('Series').findByIdAndUpdate(doc.series, {
        publicationYears: years.map(y => y.toString())
      });
    }
    next();
  } catch (err) {
    console.error('שגיאה בעדכון publicationYears אחרי שמירה:', err);
    next(err);
  }
});

volumeSchema.post('remove', async function (doc, next) {
  try {
    if (doc.series) {
      const volumes = await this.constructor.find({ series: doc.series });
      const years = [...new Set(
        volumes
          .map(v => v.publicationYear)
          .filter(y => y != null)
      )].sort((a, b) => a - b);

      await mongoose.model('Series').findByIdAndUpdate(doc.series, {
        publicationYears: years.map(y => y.toString())
      });
    }
    next();
  } catch (err) {
    console.error('שגיאה בעדכון publicationYears אחרי מחיקה:', err);
    next(err);
  }
});

// אחרי שמירת כרך (חדש או עדכון של series)
volumeSchema.post('save', async function (doc, next) {
  try {
    if (doc.series) {
      const volumesCount = await this.constructor.countDocuments({ series: doc.series });
      await mongoose.model('Series').findByIdAndUpdate(doc.series, {
        totalVolumes: volumesCount
      });
    }
    next();
  } catch (err) {
    console.error('שגיאה בעדכון totalVolumes:', err);
    next(err);
  }
});

// אחרי מחיקת כרך
volumeSchema.post('remove', async function (doc, next) {
  try {
    if (doc.series) {
      const volumesCount = await this.constructor.countDocuments({ series: doc.series });
      await mongoose.model('Series').findByIdAndUpdate(doc.series, {
        totalVolumes: volumesCount
      });
    }
    next();
  } catch (err) {
    console.error('שגיאה בעדכון totalVolumes אחרי מחיקה:', err);
    next(err);
  }
});


// -----------------------------
// Joi ולידציה
// -----------------------------
const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/, 'ObjectId');

const volumeCreateSchema = Joi.object({
  volumeNumber: Joi.number().integer().min(1),
  year: Joi.string().trim().allow('', null),
  letter: Joi.string().trim().length(1).allow('', null),
  title: Joi.string().trim(),
  mainTopic: Joi.string().trim().allow('', null),
  publicationMonth: Joi.string().trim().allow('', null),
  publicationYear: Joi.string().trim().allow('', null),
  occasion: Joi.string().trim().allow('', null),
  subtitles: Joi.array().items(objectId).default([]),
  volumeSize: Joi.string().valid('', 'גדול', 'בינוני', 'קטן').allow(''),
  coverType: Joi.string().valid('', 'קשה', 'רכה').allow(''),
  source: Joi.string().trim().allow('', null),
  catalogStatus: Joi.string().trim().allow('', null),
  series: objectId.required(),
});

const volumeUpdateSchema = volumeCreateSchema.fork(
  Object.keys(volumeCreateSchema.describe().keys),
  schema => schema.optional()
).fork(['series'], schema => schema.forbidden());

volumeSchema.statics.validateCreate = (obj) =>
  volumeCreateSchema.validate(obj, { abortEarly: false, stripUnknown: true });

volumeSchema.statics.validateUpdate = (obj) =>
  volumeUpdateSchema.validate(obj, { abortEarly: false, stripUnknown: true });

// -----------------------------
// ייצוא
// -----------------------------
const Volume = mongoose.model('Volume', volumeSchema);
module.exports = Volume;