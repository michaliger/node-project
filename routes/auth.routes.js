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
      password // 🌟 התיקון: מעבירים את הסיסמה הרגילה, המודל כבר יצפין אותה לבד!
    })
    
    console.log('סיסמה מקורית שהתקבלה:', password)

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
  console.log('ניסיון התחברות עם דוא"ל:', email)

  try {
    // 🌟 הנה התיקון! הוספנו select('+password')
    const user = await User.findOne({ email }).select('+password') 
    
    console.log('משתמש שנמצא:', user ? 'כן, id: ' + user._id : 'לא נמצא')

    if (!user) {
      return res.status(400).json({ message: 'דוא"ל או סיסמה שגויים' })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    console.log('הסיסמה תואמת?', isMatch)

    if (!isMatch) {
      return res.status(400).json({ message: 'דוא"ל או סיסמה שגויים' })
    }

    const token = jwt.sign({ userId: user._id }, 'michali-secret-key', { expiresIn: '7d' })

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }, 
      message: 'התחברת בהצלחה! ❤️'
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'שגיאה בשרת' })
  }
})

module.exports = router