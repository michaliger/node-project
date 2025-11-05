// routes/subtitle.routes.js
const express = require('express');
const {
  getallsubtitles,
  getsubtitle,
  createsubtitle,
  updatesubtitle,
  deletesubtitle
} = require('../controllers/subtitle.controller');

const router = express.Router();

// GET /api/subtitles
// POST /api/subtitles
router
  .route('/')
  .get(getallsubtitles)
  .post(createsubtitle);

// GET /api/subtitles/60d9...
// PATCH /api/subtitles/60d9...
// DELETE /api/subtitles/60d9...
router
  .route('/:id')
  .get(getsubtitle)
  .patch(updatesubtitle)
  .delete(deletesubtitle);

module.exports = router;