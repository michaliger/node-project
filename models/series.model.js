const mongoose = require('mongoose');
const Joi = require('joi');

// -----------------------------
// 1. פונקציה ליצירת slug נקי (אבל לא נשתמש בה אוטומטית – נשאיר את fileName כפי שהמשתמש הקליד)
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
// 2. סכמה של Series (סדרה/קובץ)
// -----------------------------
const seriesSchema = new mongoose.Schema({
    // שם מקדים
    prefixName: {
        type: String,
        trim: true,
        enum: ["", "ספר זכרון", "קובץ זכרון", "קובץ תורני", "קובץ", "ספר", "ירכון", "ביטעון"],
        default: ""
    },

    // שם הקובץ – חובה, ישמש גם כשם תצוגתי וגם כמזהה ב-URL
    fileName: {
        type: String,
        required: true,
        trim: true
        // לא unique – כי אנחנו מאפשרים כפילות עם identifierName
    },

    // שם מזהה – חובה רק אם fileName כבר קיים
    identifierName: {
        type: String,
        trim: true,
        default: ""
    },

    // פרטים נוספים
    details: {
        type: String,
        trim: true,
        default: ""
    },

    // עורך
    editor: {
        type: String,
        trim: true,
        default: ""
    },

    // מקום הוצאה
    publicationPlace: {
        type: String,
        trim: true,
    },

    // מגזר
    sector: {
        type: String,
        trim: true,
        default: "",
        enum: ["", "ליטאי", "חסידי", "ספרדי", "דתי"]
    },

    // סטטוס קטלוג
    catalogStatus: {
        type: String,
        trim: true,
    },

    // שנות הוצאה (מערך של שנים)
    publicationYears: {
        type: [String],
        default: []
    },

    // רשימת כרכים חסרים
    missingVolumesList: {
        type: String,
        trim: true,
        default: ""
    },

    // הערות משתמש
    userNotes: {
        type: String,
        trim: true,
        default: ""
    },

    // תיאור הקובץ
    fileDescription: {
        type: String,
        trim: true,
        default: ""
    },

    // תמונת כריכה/תמונה מייצגת
    coverImage: {
        type: String,
        default: "default-series.jpg"
    },

    // רשימת IDs של הכרכים הקשורים
    volumes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Volume'
    }],

    // מי יצר ועדכן
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        // required: true
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
seriesSchema.index({ fileName: 1 });
seriesSchema.index({ sector: 1, catalogStatus: 1 });
seriesSchema.index({ editor: 1 });

// -----------------------------
// 4. Virtual – ספירת כרכים
// -----------------------------
seriesSchema.virtual('totalVolumes').get(function () {
    return this.volumes ? this.volumes.length : 0;
});

// -----------------------------
// 5. Pre-save: ולידציה של כפילות fileName + ניהול identifierName
// -----------------------------
seriesSchema.pre('save', async function (next) {
    try {
        // ניקוי בסיסי
        if (this.fileName) {
            this.fileName = this.fileName.trim();
        }
        if (this.identifierName) {
            this.identifierName = this.identifierName.trim();
        }

        if (!this.fileName) {
            return next(new Error('שם הקובץ הוא שדה חובה'));
        }

        // בדיקה אם קיים כבר מסמך עם אותו fileName (לא כולל את עצמו בעדכון)
        const existingSeries = await mongoose.model('Series').findOne({
            fileName: this.fileName,
            _id: { $ne: this._id }
        });

        if (existingSeries) {
            // יש כפילות → identifierName חובה
            if (!this.identifierName) {
                return next(new Error('קיים כבר קובץ עם שם זהה. חובה למלא "שם מזהה" כדי להבדיל ביניהם.'));
            }
        } else {
            // אין כפילות → אפשר לנקות את identifierName כדי שלא ישאר מידע מיותר
            this.identifierName = this.identifierName || "";
        }

        next();
    } catch (err) {
        next(err);
    }
});

// -----------------------------
// 6. Post-remove: מחיקת כרכים קשורים
// -----------------------------
seriesSchema.post('remove', async function (doc, next) {
    try {
        const Volume = mongoose.model('Volume');
        await Volume.deleteMany({ series: doc._id });
        console.log(`Deleted volumes associated with series ${doc._id}`);
        next();
    } catch (err) {
        next(err);
    }
});

// -----------------------------
// 7. ולידציה עם Joi
// -----------------------------
const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/, 'ObjectId');

const seriesCreateSchema = Joi.object({
    prefixName: Joi.string().trim().allow('', null),
    fileName: Joi.string().trim().required(),
    identifierName: Joi.string().trim().allow('', null),
    details: Joi.string().trim().allow('', null),
    editor: Joi.string().trim().allow('', null),
    publicationPlace: Joi.string().trim().allow('', null),
    sector: Joi.string().trim().allow('', null),
    catalogStatus: Joi.string().optional(),
    publicationYears: Joi.array().items(Joi.string()).optional(),
    missingVolumesList: Joi.string().trim().allow('', null),
    userNotes: Joi.string().trim().allow('', null),
    fileDescription: Joi.string().trim().allow('', null),
    coverImage: Joi.string().trim().allow('', null),

    // שדות אוטומטיים – אסור לשלוח
    volumes: Joi.array().forbidden(),
    totalVolumes: Joi.any().forbidden(),
    
    createdBy: objectId.optional(),
});

const seriesUpdateSchema = seriesCreateSchema.fork(
    ['createdBy'], schema => schema.optional()
).fork(
    ['fileName'], schema => schema.optional()
);

seriesSchema.statics.validateCreate = (obj) =>
    seriesCreateSchema.validate(obj, { abortEarly: false, stripUnknown: true });

seriesSchema.statics.validateUpdate = (obj) =>
    seriesUpdateSchema.validate(obj, { abortEarly: false, stripUnknown: true });

// -----------------------------
// 8. ייצוא
// -----------------------------
const Series = mongoose.model('Series', seriesSchema);
module.exports = Series;