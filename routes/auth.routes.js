// const express = require('express');
// const {
//   signup,
//   login,
//   getMe                     // ← חייב להיות getMe עם M גדולה!
// } = require('../controllers/auth.controller');
// const { protect } = require('../middleware/auth');

// const router = express.Router();

// router.post('/signup', signup);
// router.post('/login', login);
// router.get('/me', protect, getMe);   // ← כאן בדיוק השורה 14 – חייב להיות getMe!

// module.exports = router;
const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/user.model')

// הרשמה
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body

  try {
    let user = await User.findOne({ email })
    if (user) {
      return res.status(400).json({ message: 'המשתמש כבר קיים' })
    }

    user = new User({
      name,
      email,
      password: await bcrypt.hash(password, 10)
    })

    await user.save()

    const token = jwt.sign({ userId: user._id }, 'michali-secret-key', { expiresIn: '7d' })

    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
      message: 'נרשמת בהצלחה! ❤️'
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'שגיאה בשרת' })
  }
})

// התחברות
router.post('/login', async (req, res) => {
  const { email, password } = req.body

  try {
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(400).json({ message: 'דוא"ל או סיסמה שגויים' })
      return
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      res.status(400).json({ message: 'דוא"ל או סיסמה שגויים' })
      return
    }

    const token = jwt.sign({ userId: user._id }, 'michali-secret-key', { expiresIn: '7d' })

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
      message: 'התחברת בהצלחה! ❤️'
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'שגיאה בשרת' })
  }
})

module.exports = router