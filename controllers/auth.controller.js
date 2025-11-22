const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const catchAsync = require('../utils/catchAsync');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, {
  expiresIn: process.env.JWT_EXPIRES_IN
});

exports.getMe = (req, res) => {
  res.status(200).json({
    status: 'success',
    data: {
      user: req.user
    }
  });
};

const createsendtoken = (user, statusCode, res) => {
  const token = signToken(user._id);
  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    }
  });
};

exports.signup = catchAsync(async (req, res) => {
  const { error } = User.validateSignup(req.body);
  if (error) {
    const messages = error.details.map(err => err.message);
    return res.status(400).json({
      status: 'fail',
      message: messages.join(', ')
    });
  }

  const newUser = await User.create(req.body);
  createsendtoken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res) => {
  const { error } = User.validateLogin(req.body);
  if (error) {
    return res.status(400).json({
      status: 'fail',
      message: 'אימייל וסיסמה חובה'
    });
  }

  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password))) {
    return res.status(401).json({
      status: 'fail',
      message: 'אימייל או סיסמה שגויים'
    });
  }

  createsendtoken(user, 200, res);
});