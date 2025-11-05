// routes/volume.routes.js
const express = require('express');
const {
  getallvolumes,
  getvolumebyslug,
  createvolume,
  updatevolume,
  deletevolume
} = require('../controllers/volume.controller');

const router = express.Router();

// GET /api/volumes
// POST /api/volumes
router
  .route('/')
  .get(getallvolumes)
  .post(createvolume);

// GET /api/volumes/bereshit-1a
router
  .route('/:fileName')
  .get(getvolumebyslug);

// PATCH /api/volumes/60d8...
// DELETE /api/volumes/60d8...
router
  .route('/:id')
  .patch(updatevolume)
  .delete(deletevolume);

module.exports = router;