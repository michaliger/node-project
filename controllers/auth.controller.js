const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const catchAsync = require('../utils/catchAsync');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, {
  expiresIn: process.env.JWT_EXPIRES_IN
});

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      }
    }
  });
};

exports.getMe = (req, res) => {
  res.status(200).json({
    status: 'success',
    data: { user: req.user }
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  console.log('נתונים שהתקבלו בהרשמה:', req.body);

  const { name, email, password } = req.body;

  // ולידציה עם Joi
  const { error } = User.validateSignup({ name, email, password });
  if (error) {
    console.log('שגיאת ולידציה בהרשמה:', error.details);
    const messages = error.details.map(d => d.message).join(', ');
    return res.status(400).json({
      status: 'fail',
      message: messages
    });
  }

  // בדיקת כפילות - רק על אימייל
  const existingUser = await User.findOne({ email: email.trim().toLowerCase() });

  if (existingUser) {
    return res.status(400).json({
      status: 'fail',
      message: 'האימייל כבר רשום במערכת'
    });
  }

  try {
    const newUser = await User.create({
      name,
      email: email.trim().toLowerCase(),
      password,
    });

    console.log('משתמש נוצר בהצלחה:', newUser.email);
    createSendToken(newUser, 201, res);
  } catch (err) {
    console.error('שגיאה ביצירת משתמש:', err);
    res.status(500).json({
      status: 'fail',
      message: 'שגיאה ביצירת משתמש – ' + err.message
    });
  }
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  console.log('🔑 ניסיון התחברות עם:', { 
    email: email?.trim().toLowerCase(), 
    hasPassword: !!password 
  });

  // ולידציה בסיסית
  const { error } = User.validateLogin({ email, password });
  if (error) {
    console.log('שגיאת ולידציה בהתחברות:', error.details);
    return res.status(400).json({
      status: 'fail',
      message: 'אימייל וסיסמה חובה'
    });
  }

  // חיפוש המשתמש + הבאת הסיסמה המוצפנת
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
  
  console.log('👤 משתמש נמצא?', !!user);
  if (user) {
    console.log('אימייל במסד:', user.email);
  }

  // בדיקת סיסמה
  let isPasswordCorrect = false;
  if (user) {
    isPasswordCorrect = await user.correctPassword(password);
    console.log('✅ סיסמה תקינה?', isPasswordCorrect);
  }

  if (!user || !isPasswordCorrect) {
    return res.status(401).json({
      status: 'fail',
      message: 'אימייל או סיסמה שגויים'
    });
  }

  console.log('🎉 התחברות הצליחה עבור:', user.email);
  createSendToken(user, 200, res);
});