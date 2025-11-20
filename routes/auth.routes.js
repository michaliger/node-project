const express = require('express');
const {
  signup,
  login,
  getMe                     // ← חייב להיות getMe עם M גדולה!
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', protect, getMe);   // ← כאן בדיוק השורה 14 – חייב להיות getMe!

module.exports = router;