const mongoose = require('mongoose');
const Joi = require('joi');

// -----------------------------
// 1. פונקציה ליצירת fileName אוטומטי (Slug)
// -----------------------------
const createSlug = (text) => {
    if (!text) return '';
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^א-תa-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .trim();
};

// -----------------------------
// 2. סכמה של Series (סדרה)
// -----------------------------
const seriesSchema = new mongoose.Schema({
    // שם מקדים (למשל: סדרת ספרי)
    prefixName: {
        type: String,
        trim: true,
        default: null
    },

    // שם קובץ ל-URL (ייחודי, אוטומטי, חובה)
    fileName: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },

    // מזהה נוסף/שם מזהה (למקרה של כפילות בשם)
    identifierName: {
        type: String,
        trim: true,
        default: null
    },

    // פרטים
    details: {
        type: String,
        trim: true,
        default: null
    },

    // מחבר / עורכים
    author: {
        type: String,
        trim: true,
        default: null
    },

    // מקום הוצאה
    publicationPlace: {
        type: String,
        trim: true
    },

    // מגזר
    sector: {
        type: String,
        trim: true,
        default: null
    },

    // סטטוס קטלוג
    catalogStatus: {
        type: String,
        enum: ['חלקי', 'שלם'],
        default: 'חלקי'
    },

    // שנות הוצאה
    publicationYears: {
        type: String,
        trim: true
    },

    // סה"כ גליונות – *אוטומטי, מנוהל ע"י Volume.js*
    totalVolumes: {
        type: Number,
        default: 0
    },

    // רשימת IDs של הכרכים – *אוטומטי, מנוהל ע"י Volume.js*
    volumes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Volume',
        default: []
    }],

    // שדות מידע כללי (כפי שהיו בסכימה המקורית שלך)

    //רשימת כרכים חסרים
    missingVolumesList: {
        type: String,
        trim: true,
        default: ''
    },
    // הערות 
    userNotes: {
        type: String,
        trim: true,
        default: ''
    },

    //תאור הקוץ
    fileDescription: {
        type: String,
        trim: true,
        default: ''
    },
    // תמונת סדרה
    coverImage: {
        type: String,
        default: 'default-series.jpg'
    },
    // מ"ס אוטומטי
    msID: {
        type: String,
        trim: true,
        default: null
    },

    // מי יצר/עדכן
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
// 3. אינדקסים
// -----------------------------
seriesSchema.index({ fileName: 1 }, { unique: true });
seriesSchema.index({ title: 1 }, { unique: true }); // ודאות שאין שמות סדרה זהים
seriesSchema.index({ sector: 1, catalogStatus: 1 });
seriesSchema.index({ author: 1 });

// -----------------------------
// 4. Virtuals
// -----------------------------
seriesSchema.virtual('volumeCount').get(function () {
    return this.volumes ? this.volumes.length : 0;
});

// -----------------------------
// 5. Pre-save: יצירת fileName אוטומטי + עדכון updatedBy
// -----------------------------
seriesSchema.pre('save', async function (next) {
    try {
        // 1. יצירת fileName אוטומטי אם חסר
        if (this.isNew || this.isModified('title')) {
            let base = createSlug(this.title);

            // וידוא ייחודיות (דומה למה שב-Volume.js)
            let slug = base;
            let counter = 1;
            while (await mongoose.model('Series').countDocuments({ fileName: slug, _id: { $ne: this._id } })) {
                slug = `${base}-${counter}`;
                counter++;
            }
            this.fileName = slug;
        }

        // 2. עדכון updatedBy
        if (this.isModified()) {
            this.updatedBy = this.createdBy || null;
        }

        next();
    } catch (err) {
        next(err);
    }
});


// -----------------------------
// 6. Post-remove: מחיקת כרכים קשורים (Cleanup)
// -----------------------------
seriesSchema.post('remove', async function (doc, next) {
    try {
        const Volume = mongoose.model('Volume');
        // מחיקת כל הכרכים שמקושרים לסדרה שנמחקה
        await Volume.deleteMany({ series: doc._id });
        console.log(`Deleted ${doc.volumes.length} volumes associated with series ${doc._id}`);
        next();
    } catch (err) {
        next(err);
    }
});

// -----------------------------
// 7. וולידציה עם Joi
// -----------------------------
const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/, 'ObjectId');

const seriesCreateSchema = Joi.object({
    prefixName: Joi.string().trim().allow('', null),
    fileName: Joi.string().trim().lowercase().optional(), // אוטומטי – לא חייב לשלוח
    identifierName: Joi.string().trim().allow('', null),
    details: Joi.string().trim().allow('', null),
    author: Joi.string().trim().allow('', null),
    publicationPlace: Joi.string().trim().allow('', null),
    publicationYears: Joi.string().trim().allow('', null),
    sector: Joi.string().trim().allow('', null),
    catalogStatus: Joi.string().valid('חלקי', 'שלם').optional(),

    // שדות כלליים
    dataCompleteness: Joi.string().trim().allow('', null),
    missingVolumesList: Joi.string().trim().allow('', null),
    userNotes: Joi.string().trim().allow('', null),
    adminNotes: Joi.string().trim().allow('', null),
    fileDescription: Joi.string().trim().allow('', null),
    coverImage: Joi.string().trim().allow('', null),
    msID: Joi.string().trim().allow('', null),

    // שדות אוטומטיים/מנוהלים – לא חובה בעת יצירה/עדכון
    totalVolumes: Joi.number().integer().forbidden(),
    volumes: Joi.array().items(objectId).forbidden(),

    // מי יצר
    createdBy: objectId.required(),
});

const seriesUpdateSchema = seriesCreateSchema.fork(
    Object.keys(seriesCreateSchema.describe().keys),
    schema => schema.optional()
).fork(['fileName'], schema => schema.forbidden()); // לא מאפשר לעדכן fileName ישירות

seriesSchema.statics.validateCreate = (obj) =>
    seriesCreateSchema.validate(obj, { abortEarly: false, stripUnknown: true });

seriesSchema.statics.validateUpdate = (obj) =>
    seriesUpdateSchema.validate(obj, { abortEarly: false, stripUnknown: true });


// -----------------------------
// 8. ייצוא
// -----------------------------
const Series = mongoose.model('Series', seriesSchema);
module.exports = Series;