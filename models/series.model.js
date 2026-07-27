const mongoose = require('mongoose');
const Joi = require('joi');

const seriesSchema = new mongoose.Schema({
    prefixName: {
        type: String,
        trim: true,
        enum: [ "","עלונים","קבצים בודדים","גנוזות וכתבי יד","קבצים משפחתיים","הספדים ודרשות","קבצי קהילות ובתי כנסת", "קבצי כוללים", "קבצי ישיבות", "ספרי קהילות", "כתבי עת ותקופונים", "ספרי זכרון ויובל"],
        default: ""
    },
    fileName: {
        type: String,
        required: true,
        trim: true
    }, 
    identifierName: {
        type: String,
        trim: true,
        default: ""
    },
    details: { type: String, trim: true, default: "" },
    editor: { type: String, trim: true, default: "" },
    publicationPlace: { type: String, trim: true },
    sector: {
        type: String,
        trim: true,
        default: "",
    },
    catalogStatus: { type: String, trim: true, default: "טיוטה" },
    publicationYears: {
        type: [String],
        default: []
    },
    missingVolumesList: { type: String, trim: true, default: "" },
    userNotes: { type: String, trim: true, default: "" },
    fileDescription: { type: String, trim: true, default: "" },
    coverImage: {
        type: String,
        default: "default-series.jpg"
    },
    volumes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Volume'
    }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// --- וולידציה עם Joi ---
const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/, 'ObjectId');

const seriesCreateSchema = Joi.object({
    prefixName: Joi.string().valid("", "ספר זכרון", "קובץ זכרון", "קובץ תורני", "קובץ", "ספר", "ירחון", "ביטאון").allow(''),
    fileName: Joi.string().trim().required().messages({
        'any.required': 'שם הקובץ הוא שדה חובה'
    }),
    identifierName: Joi.string().trim().allow(''),
    details: Joi.string().trim().allow(''),
    editor: Joi.string().trim().allow(''),
    publicationPlace: Joi.string().trim().allow(''),
    sector: Joi.string().allow(''),
    catalogStatus: Joi.string().default("טיוטה"),
    missingVolumesList: Joi.string().trim().allow(''),
    userNotes: Joi.string().trim().allow(''),
    fileDescription: Joi.string().trim().allow(''),
    createdBy: objectId.optional(),
    // שדה זה בדרך כלל לא נשלח מהפרונט ביצירה ראשונית, אבל כדאי שיהיה ב-Joi
    volumes: Joi.array().items(objectId).default([])
});

seriesSchema.statics.validateCreate = (obj) => seriesCreateSchema.validate(obj, { abortEarly: false, stripUnknown: true });

// --- אינדקסים, Virtuals ו-Hooks ---

seriesSchema.index({ fileName: 1 });
seriesSchema.index({ sector: 1, catalogStatus: 1 });

seriesSchema.virtual('totalVolumes').get(function () {
    return this.volumes ? this.volumes.length : 0;
});

seriesSchema.pre('save', async function (next) {
    try {
        if (!this.fileName) return next(new Error('שם הקובץ הוא שדה חובה'));

        const existingSeries = await mongoose.model('Series').findOne({
            fileName: this.fileName,
            _id: { $ne: this._id }
        });

        if (existingSeries && !this.identifierName) {
            return next(new Error('קיים כבר קובץ עם שם זהה. חובה למלא "שם מזהה".'));
        }
        next();
    } catch (err) {
        next(err);
    }
});

// הערה חשובה: ה-hook הקודם היה רשום על 'remove', אבל הקוד בקונטרולרים קורא
// ל-doc.deleteOne() (או ל-findByIdAndDelete) - ו-'remove' פשוט לא רץ יותר
// ב-Mongoose המודרני. לכן ה-hooks הבאים רשומים על 'deleteOne', כדי שינוקו
// באמת הכרכים (Volumes) המשויכים, לא משנה דרך איזה נתיב בקוד מוחקים את הסדרה.

// מקרה 1: doc.deleteOne() על מסמך שכבר בזיכרון (כך עושה series.controller.js)
seriesSchema.post('deleteOne', { document: true, query: false }, async function (doc) {
    const volumeIds = await mongoose.model('Volume').find({ series: doc._id }).distinct('_id');
    await mongoose.model('Subtitle').deleteMany({ volume: { $in: volumeIds } });
    await mongoose.model('Volume').deleteMany({ series: doc._id });
});

// מקרה 2: מחיקה ישירה דרך שאילתה, למשל Series.findByIdAndDelete(id),
// בלי לעבור דרך הקונטרולר הראשי - כדי שלא יישארו כרכים/מאמרים יתומים ב-Atlas
seriesSchema.pre('findOneAndDelete', async function (next) {
    try {
        const doc = await this.model.findOne(this.getFilter());
        if (doc) {
            const volumeIds = await mongoose.model('Volume').find({ series: doc._id }).distinct('_id');
            await mongoose.model('Subtitle').deleteMany({ volume: { $in: volumeIds } });
            await mongoose.model('Volume').deleteMany({ series: doc._id });
        }
        next();
    } catch (err) {
        next(err);
    }
});

const Series = mongoose.model('Series', seriesSchema);
module.exports = Series;