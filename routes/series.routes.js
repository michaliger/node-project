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

module.exports = router;