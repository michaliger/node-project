const express = require('express');
const { signup, login, getMe } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/signup
router.post('/signup', signup);

// POST /api/auth/login
router.post('/login', login);

// GET /api/auth/me  (מי אני? – אחרי התחברות)
router.get('/me', protect, getMe);

module.exports = router;