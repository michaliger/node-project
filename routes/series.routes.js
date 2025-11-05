// routes/series.routes.js
const express = require('express');
const {
  getallseries,
  getseriesbyslug,
  createseries,
  updateseries,
  deleteseries
} = require('../controllers/series.controller');

const router = express.Router();

// GET /api/series
// POST /api/series
router
  .route('/')
  .get(getallseries)
  .post(createseries);

// GET /api/series/orot-tshuva
router
  .route('/:fileName')
  .get(getseriesbyslug);

// PATCH /api/series/60d7...
// DELETE /api/series/60d7...
router
  .route('/:id')
  .patch(updateseries)
  .delete(deleteseries);

module.exports = router;