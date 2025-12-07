const Series = require('../models/series.model');
const Volume = require('../models/volume.model');
const Subtitle = require('../models/subtitle.model');

const seedFullSeries = async (req, res) => {
  try {

    const items = req.body;
    const results = [];

    const adminUserId = "691f8b89e60ae71b1932aab0";

    for (const item of items) {
      const { series: seriesData, volumes: volumesData } = item;

      // 1. יוצרים את הסדרה + מוסיפים מי יצר
      const createdSeries = await Series.create({
        ...seriesData,
        createdBy: adminUserId,
        updatedBy: adminUserId
      });

      const createdVolumeIds = [];

      for (const volData of volumesData) {
        const { subtitles: subtitlesData, ...volumeData } = volData;

        // יוצרים את כל הכותרות המשנה + מוסיפים מי יצר
        const createdSubtitles = subtitlesData?.length > 0
          ? await Subtitle.insertMany(
              subtitlesData.map(s => ({
                ...s,
                createdBy: adminUserId,
                updatedBy: adminUserId
              }))
            )
          : [];

        // יוצרים את הכרך + מוסיפים מי יצר + מקשרים כותרות
        const createdVolume = await Volume.create({
          ...volumeData,
          series: createdSeries._id,
          subtitles: createdSubtitles.map(s => s._id),
          createdBy: adminUserId,
          updatedBy: adminUserId
        });

        createdVolumeIds.push(createdVolume._id);
      }

      // מעדכנים את הסדרה עם כל הכרכים
      await Series.findByIdAndUpdate(createdSeries._id, {
        volumes: createdVolumeIds
      });

      results.push(createdSeries._id);
    }

    res.status(201).json({
      message: `הוכנסו בהצלחה ${results.length} סדרות מלאות! 🎉`,
      count: results.length
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { seedFullSeries };