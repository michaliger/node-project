const Series = require('../models/series.model');
const Volume = require('../models/volume.model');
const Article = require('../models/subtitle.model'); // וודאי שייבאת את מודל המאמרים
const catchAsync = require('../utils/catchAsync');

exports.createSeries = catchAsync(async (req, res) => {
    // 1. חילוץ הנתונים מה-FormData
    const allData = JSON.parse(req.body.seriesData);
    
    // 2. טיפול בתמונת כריכה לסדרה
    const coverFile = req.files.find(f => f.fieldname === 'coverImage');
    const seriesToSave = { ...allData };
    if (coverFile) seriesToSave.coverImage = coverFile.path;

    // 3. שמירת הסדרה (טבלה 1)
    const newSeries = await Series.create(seriesToSave);

    // 4. ריצה על הגליונות (טבלה 2)
    if (allData.volumes && allData.volumes.length > 0) {
        for (let i = 0; i < allData.volumes.length; i++) {
            const volData = allData.volumes[i];
            
            // מציאת ה-PDF של הגליון הספציפי
            const pdfFile = req.files.find(f => f.fieldname === `pdf_vol_${i}`);
            
            const newVolume = await Volume.create({
                ...volData,
                series: newSeries._id, // הקישור לסדרה!
                pdfPath: pdfFile ? pdfFile.path : null,
                createdBy: allData.createdBy
            });

            // 5. ריצה על המאמרים בתוך הגליון (טבלה 3)
            // רק אם יש מאמרים והם לא ריקים
            if (volData.articles && volData.articles.length > 0) {
                const articlesWithLinks = volData.articles
                    .filter(art => art.title) // שומר רק אם יש כותרת למאמר
                    .map(art => ({
                        ...art,
                        volume: newVolume._id, // הקישור לגליון!
                        series: newSeries._id, // קישור אופציונלי לסדרה
                        createdBy: allData.createdBy
                    }));
                
                if (articlesWithLinks.length > 0) {
                    await Article.insertMany(articlesWithLinks);
                }
            }
            
            // עדכון ה-ID של הגליון בתוך הסדרה (אם המודל שלך דורש זאת)
            await Series.findByIdAndUpdate(newSeries._id, {
                $push: { volumes: newVolume._id }
            });
        }
    }

    res.status(201).json({
        status: 'success',
        message: 'הכל נשמר בנפרד ומקושר: סדרה, גליונות ומאמרים',
        data: { series: newSeries }
    });
});