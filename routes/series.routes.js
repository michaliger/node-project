// routes/series.routes.js
const express = require('express');
const {
  getAllSeries,
  getSeriesBySlug,
  createSeries,
  updateSeries,
  deleteSeries

} = require('../controllers/series.controller');

const { protect, restrictTo } = require('../middleware/auth');
const Series = require('../models/series.model');
const router = express.Router();

// הגנה על כל הראוטים (אם את רוצה – אפשר להסיר)
// router.use(protect);

// GET /api/series
// POST /api/series
router
  .route('/')
  .get(getAllSeries)
  .post(createSeries);

// GET /api/series/orot-tshuva
router
  .route('/:fileName')
  .get(getSeriesBySlug);

// PATCH /api/series/60d7...
// DELETE /api/series/60d7...
router
  .route('/:id')
  .patch(updateSeries)
  .delete(deleteSeries);

router.post('/bulk', async (req, res) => {
  try {
    const series = req.body;
    await Series.deleteMany({});        // אם את רוצה לנקות קודם
    const inserted = await Series.insertMany(series);
    res.status(201).json({ message: `הוכנסו ${inserted.length} סדרות בהצלחה!` });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});
module.exports = router;