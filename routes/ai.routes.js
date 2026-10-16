// routes/ai.routes.js  -  גרסת Gemini (חינמית), מהירה
// מקבל עמוד אחד (תמונה/PDF) בכל בקשה, שולח ל-Gemini, ומחזיר נתונים מסודרים
const express = require('express');
const multer = require('multer');
const { GoogleGenAI } = require('@google/genai');

const router = express.Router();

// הקבצים נשמרים בזיכרון בלבד, רק כדי לשלוח ל-AI
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 }
});

// המפתח נקרא ממשתנה סביבה (ב-Render: Environment). לא כותבים אותו בקוד!
let aiClient = null;
const getAi = () => {
  if (!aiClient) aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return aiClient;
};

// אפשר להחליף דגם בלי לגעת בקוד: משתנה סביבה GEMINI_MODEL ב-Render
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

// רמת "חשיבה": ברירת המחדל של גוגל בדגמי Gemini 3 היא high, וזה איטי מאוד.
// לקריאת תוכן עניינים מספיק low. אם עוברים לדגם ישן (2.5) שלא תומך בזה,
// מגדירים ב-Render: GEMINI_THINKING_LEVEL=off
const THINKING_LEVEL = process.env.GEMINI_THINKING_LEVEL || 'low';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

// ===== כאן מגדירים את הדרישות שלך מה-AI. אפשר לשנות כל כלל =====
const SYSTEM_PROMPT = `יש לחלץ תוכן עניינים מצילום של עמוד מכתב עת או קובץ תורה, עבור קטלוג ספרייה.

כללים:
1. יש להעתיק את הטקסט בדיוק כפי שהוא מודפס, מילה במילה. אין לתקן שגיאות כתיב, אין להחליף מילה בצורה "נכונה" ואין לשפר ניסוח, גם אם נראית טעות דפוס. לדוגמה: אם מודפס "להיזק" אין לכתוב "להזיק", ואם מודפס "סיים" אין לכתוב "סיום". אם מילה אינה קריאה, יש לכתוב [?] במקומה.
2. כל פריט בתוכן העניינים הוא מאמר אחד: כותרת המאמר, ומתחתיה או לידה שם המחבר, ומספר העמוד (לרוב בקצה השורה, אחרי קו או נקודות).
3. כותרות סעיפים (למשל "קרית המכתבים") אינן מאמרים. הן שם המדור של כל המאמרים שמתחתיהן, עד הכותרת הבאה, ויש לרשום את שם המדור בכל אחד מהמאמרים האלה. מאמרים שמופיעים לפני כותרת סעיף ראשונה - מדור ריק.
4. מחבר: יש לפצל לתואר (למשל הרה"ג, הרב, הרה"ח, הגאון), שם פרטי ושם משפחה. סיומות כבוד כמו שליט"א, זצ"ל, נר"ו, נ"י אינן נכללות בשדות.
5. מספר עמוד: להעתיק בדיוק כפי שמופיע, גם אם הוא באותיות עבריות (למשל יג, כד). אין להמיר למספר.
6. יש להתעלם מכותרות עליונות ותחתונות, מסימני מים ומחותמות (כמו "הודפס מאוצר החכמה").
7. אם יש כמה מחברים למאמר, הראשון נכנס לשדות המחבר, והאחרים לשדה ההערות.
8. יש לשמור על סדר המאמרים כפי שהוא בעמוד.
9. פרטי הקובץ (שם הקובץ, מספר גליון, שנה) - רק אם הם מופיעים בבירור בעמוד. אחרת להשאיר מחרוזת ריקה.

פורמט התשובה: JSON בלבד, בלי שום טקסט נוסף, במבנה הבא:
{
  "series": { "fileName": "" },
  "volume": { "volumeNumber": "", "volumeTitle": "", "publicationYear": "" },
  "articles": [
    { "section": "", "contentTitle": "", "titlePrefix": "", "firstName": "", "lastName": "", "startPage": "", "note": "" }
  ]
}
כל השדות הם מחרוזות. שדה ללא מידע נשאר מחרוזת ריקה.`;

function parseJsonSafely(text) {
  const cleaned = (text || '').replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

// אם גוגל לא עונה, לא מחכים בלי סוף
const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms))
  ]);

// כדי להגן על המכסה: הוסיפי כאן את ה-middleware שבודק שהמשתמש מחובר/מנהל
// למשל: router.post('/extract-toc', protect, restrictToAdmin, upload.array(...), ...)
router.post('/extract-toc', upload.array('files', 10), async (req, res) => {
  const startedAt = Date.now();
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ status: 'fail', message: 'לא הוגדר מפתח GEMINI_API_KEY בשרת.' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ status: 'fail', message: 'לא הועלו קבצים' });
    }

    const badFile = req.files.find(f => !ALLOWED_TYPES.includes(f.mimetype));
    if (badFile) {
      return res.status(400).json({
        status: 'fail',
        message: `סוג קובץ לא נתמך: ${badFile.originalname}. אפשר להעלות JPG, PNG, WebP או PDF.`
      });
    }

    console.log(`extract-toc: ${req.files.length} קבצים, דגם ${MODEL}, חשיבה ${THINKING_LEVEL}`);

    // התמונות קודם, ואחריהן ההוראה
    const parts = req.files.map(f => ({
      inlineData: { mimeType: f.mimetype, data: f.buffer.toString('base64') }
    }));
    parts.push({ text: 'יש לחלץ את תוכן העניינים מהקובץ שהועלה ולהחזיר JSON בלבד.' });

    const config = {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      maxOutputTokens: 8000
    };
    if (THINKING_LEVEL !== 'off') config.thinkingConfig = { thinkingLevel: THINKING_LEVEL };

    const response = await withTimeout(
      getAi().models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts }],
        config
      }),
      100000
    );
    console.log(`Gemini ענה אחרי ${Math.round((Date.now() - startedAt) / 1000)} שניות`);

    let data;
    try {
      data = parseJsonSafely(response.text);
    } catch (e) {
      console.error('Bad JSON from model:', response.text);
      return res.status(500).json({ status: 'fail', message: 'התוצאה לא הייתה תקינה. נא לנסות שוב.' });
    }

    if (!Array.isArray(data.articles)) data.articles = [];
    res.status(200).json({ status: 'success', data });
  } catch (err) {
    console.error('AI extract error:', err);
    if (err?.message === 'TIMEOUT') {
      return res.status(504).json({ status: 'fail', message: 'גוגל לא הגיבה בזמן. נא לנסות שוב.' });
    }
    const isLimit = err?.status === 429 || /429|RESOURCE_EXHAUSTED/i.test(err?.message || '');
    res.status(isLimit ? 429 : 500).json({
      status: 'fail',
      message: isLimit
        ? 'הגעת למגבלת השימוש החינמית של גוגל. נא להמתין דקה ולנסות שוב (או מחר, אם המכסה היומית נגמרה).'
        : 'שגיאה בקריאת התוכן: ' + (err?.message || '').slice(0, 300)
    });
  }
});

module.exports = router;
