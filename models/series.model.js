const mongoose = require('mongoose');
const Joi = require('joi');

// -----------------------------
// 1. סכמה של Mongoose
// -----------------------------

const seriesSchema = new mongoose.Schema({
  // שם מקדים (למשל: "סדרת", "אוסף")
  prefixName: {
    type: String,
    trim: true,               // מסיר רווחים מיותרים מההתחלה והסוף
    default: null
  },

  // תמונת שער של הסדרה
  coverImage: {
    type: String,
    default: 'default-series.jpg'  // תמונה ברירת מחדל אם אין
  },

  // שם הקובץ (מזהה ייחודי, כמו URL slug)
  fileName: {
    type: String,
    required: true,
    unique: true,             // חייב להיות ייחודי – לא יכולות להיות 2 סדרות עם אותו fileName
    trim: true,
    lowercase: true           // הופך לאותיות קטנות אוטומטית (למשל: HarryPotter → harrypotter)
  },

  // כינוי לקובץ (אופציונלי, עם אפשרות להציג לציבור)
  fileAlias: {
    value: {
      type: String,
      trim: true,
      default: null
    },
    public: {
      type: Boolean,
      default: false
    }
  },

  // פרטים כלליים על הסדרה
  details: {
    type: String,
    trim: true,
    default: null
  },

  // רשימת כרכים (מזהים של Volume)
  volumes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Volume',
    default: []
  }],

  // מקום הוצאה לאור
  publicationPlace: {
    type: String,
    trim: true,
    default: null
  },

  // שנות פרסום – יתמלא אוטומטית לפי הכרכים
  publicationYears: {
    type: [Number],
    default: []
  },

  // ז'אנר / מגזר
  genre: {
    type: String,
    trim: true,
    default: null
  },

  // רמת נדירות / חשיבות
  rarity: {
    type: String,
    trim: true,
    default: null
  },

  // נושא ראשי – יתמלא אוטומטית לפי הכרכים
  mainTopic: {
    type: String,
    trim: true,
    default: null
  },

  // הערות חופשיות
  notes: {
    type: String,
    trim: true,
    default: null
  }
}, {
  timestamps: true,           // יוצר createdAt ו-updatedAt אוטומטית
  toJSON: { virtuals: true }, // מאפשר virtuals ב-toJSON
  toObject: { virtuals: true }
});

// -----------------------------
// 2. אינדקסים (Indexes)
// -----------------------------
seriesSchema.index({ fileName: 1 }, { unique: true });
// יוצר אינדקס ייחודי על fileName – מבטיח:
// - חיפוש מהיר לפי fileName
// - מניעת כפילויות (גם אם unique קיים, אינדקס מחזק את זה)

// אינדקס נוסף לחיפוש לפי ז'אנר ונדירות (שימושי בפילטרים)
seriesSchema.index({ genre: 1, rarity: 1 });

// -----------------------------
// 3. Virtual – כמות כרכים
// -----------------------------
seriesSchema.virtual('volumeCount').get(function () {
  if (!this.volumes || this.volumes.length === 0) return [];
  return this.volumes.length;
});

// -----------------------------
// 4. Pre-save Hook – עדכון אוטומטי של שדות
// -----------------------------
seriesSchema.pre('save', async function (next) {
  if (this.isModified('volumes') || this.isNew) {
    try {
      const Volume = mongoose.model('Volume');
      const populatedVolumes = await Volume.find({
        _id: { $in: this.volumes }
      }).select('publicationYear mainTopic');

      // עדכון שנות פרסום (ללא כפילויות, ממוינות)
      const years = populatedVolumes
        .map(v => v.publicationYear)
        .filter(year => year != null)
        .sort((a, b) => a - b);
      this.publicationYears = [...new Set(years)];

      // נושא ראשי – הנפוץ ביותר
      const topicCount = {};
      populatedVolumes.forEach(v => {
        if (v.mainTopic) {
          topicCount[v.mainTopic] = (topicCount[v.mainTopic] || 0) + 1;
        }
      });
      this.mainTopic = Object.keys(topicCount)
        .sort((a, b) => topicCount[b] - topicCount[a])[0] || null;

      next();
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }
});

// -----------------------------
// 5. וולידציה עם Joi
// -----------------------------
const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/, 'ObjectId');

const seriesCreateSchema = Joi.object({
  prefixName: Joi.string().trim().allow('', null),
  coverImage: Joi.string().allow('').default('default-series.jpg'),
  fileName: Joi.string().trim().lowercase().required(),
  fileAlias: Joi.object({
    value: Joi.string().trim().allow('', null),
    public: Joi.boolean().default(false)
  }).optional(),
  details: Joi.string().trim().allow('', null),
  volumes: Joi.array().items(objectId).default([]),
  publicationPlace: Joi.string().trim().allow('', null),
  publicationYears: Joi.array().items(Joi.number().integer()).default([]),
  genre: Joi.string().trim().allow('', null),
  rarity: Joi.string().trim().allow('', null),
  mainTopic: Joi.string().trim().allow('', null),
  notes: Joi.string().trim().allow('', null)
});

// עדכון – כל השדות אופציונליים
const seriesUpdateSchema = seriesCreateSchema.fork(
  Object.keys(seriesCreateSchema.describe().keys),
  schema => schema.optional()
);

// הוספת פונקציות וולידציה למודל
seriesSchema.statics.validateCreate = (obj) =>
  seriesCreateSchema.validate(obj, { abortEarly: false, stripUnknown: true });

seriesSchema.statics.validateUpdate = (obj) =>
  seriesUpdateSchema.validate(obj, { abortEarly: false, stripUnknown: true });

// -----------------------------
// 6. ייצוא המודל
// -----------------------------
const Series = mongoose.model('Series', seriesSchema);
module.exports = Series;