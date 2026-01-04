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
        idNumber: user.idNumber  // אפשר להחזיר או לא – לפי הצורך
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
  console.log('נתונים שהתקבלו:', req.body);  // ← נראה מה בדיוק נשלח

  const { name, email, password, idNumber } = req.body;

  // ולידציה עם Joi
  const { error } = User.validateSignup({ name, email, password, idNumber });
  if (error) {
    console.log('שגיאת ולידציה:', error.details);
    const messages = error.details.map(d => d.message).join(', ');
    return res.status(400).json({
      status: 'fail',
      message: messages
    });
  }

  // בדיקת כפילות
  const existingUser = await User.findOne({
    $or: [{ email }, { idNumber }]
  });

  if (existingUser) {
    console.log('משתמש קיים:', existingUser);
    return res.status(400).json({
      status: 'fail',
      message: 'אימייל או תעודת זהות כבר קיימים'
    });
  }

  try {
    const newUser = await User.create({
      name,
      email,
      password,
      idNumber
    });

    console.log('משתמש נוצר בהצלחה:', newUser);
    createSendToken(newUser, 201, res);
  } catch (err) {
    console.error('שגיאה ב-User.create:', err);  // ← כאן נראה את השגיאה המדויקת!
    res.status(500).json({
      status: 'fail',
      message: 'שגיאה ביצירת משתמש – ' + err.message
    });
  }
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  const { error } = User.validateLogin({ email, password });
  if (error) {
    return res.status(400).json({
      status: 'fail',
      message: 'אימייל וסיסמה חובה'
    });
  }

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.correctPassword(password))) {
    return res.status(401).json({
      status: 'fail',
      message: 'אימייל או סיסמה שגויים'
    });
  }

  createSendToken(user, 200, res);
});