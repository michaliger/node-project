const Series = require('../models/series.model');
const Volume = require('../models/volume.model');
const Subtitle = require('../models/subtitle.model');

// הפונקציה הקסומה שמכניסה הכל בבת אחת!
const seedFullSeries = async (req, res) => {
    try {
        await Series.deleteMany({});
        await Volume.deleteMany({});
        await Subtitle.deleteMany({});
        const items = req.body; // מערך של סדרות שלמות

        const results = [];

        for (const item of items) {
            const { series: seriesData, volumes: volumesData } = item;

            // 1. יוצרים את הסדרה
            const createdSeries = await Series.create(seriesData);

            // 2. עוברים על כל כרך
            const createdVolumeIds = [];

            for (const volData of volumesData) {
                const { subtitles: subtitlesData, ...volumeData } = volData;

                // קישור לכרך לסדרה
                volumeData.series = createdSeries._id;

                // יוצרים את כל כותרות המשנה של הכרך
                const createdSubtitles = subtitlesData
                    ? await Subtitle.insertMany(subtitlesData)
                    : [];

                volumeData.subtitles = createdSubtitles.map(s => s._id);

                // יוצרים את הכרך
                const createdVolume = await Volume.create(volumeData);
                createdVolumeIds.push(createdVolume._id);
            }

            // 3. מעדכנים את הסדרה עם כל הכרכים
            await Series.findByIdAndUpdate(createdSeries._id, {
                $set: { volumes: createdVolumeIds }
            });

            // 4. מחזירים את הסדרה המלאה
            const fullSeries = await Series.findById(createdSeries._id)
                .populate({
                    path: 'volumes',
                    populate: { path: 'subtitles' }
                });

            results.push(fullSeries);
        }

        res.status(201).json({
            message: `הוכנסו ${results.length} סדרות מלאות + כרכים + כותרות משנה!`,
            count: results.length,
            data: results
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

module.exports = { seedFullSeries };