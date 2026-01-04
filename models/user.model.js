const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Joi = require('joi');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'חובה להזין שם מלא'],
    trim: true,
    minlength: [2, 'שם חייב להכיל לפחות 2 תווים']
  },
  email: {
    type: String,
    required: [true, 'חובה להזין אימייל'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'חובה להזין סיסמה'],
    minlength: [6, 'סיסמה חייבת להיות לפחות 6 תווים']
  },
  role: {
    type: String,
    enum: ['admin', 'editor', 'viewer'],
    default: 'viewer'
  },

}, {
  timestamps: true
});

// הצפנת סיסמה
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.correctPassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Joi ולידציה להרשמה
userSchema.statics.validateSignup = (data) => {
  const schema = Joi.object({
    name: Joi.string().min(2).required().messages({
      'string.empty': 'שם מלא חובה',
      'string.min': 'שם חייב להכיל לפחות 2 תווים'
    }),
    email: Joi.string().email().required().messages({
      'string.email': 'אימייל לא תקין',
      'string.empty': 'אימייל חובה'
    }),
    password: Joi.string().min(6).required().messages({
      'string.min': 'סיסמה חייבת להיות לפחות 6 תווים',
      'string.empty': 'סיסמה חובה'
    }),
    role: Joi.string().valid('admin', 'editor', 'viewer').default('viewer')
  });

  return schema.validate(data, { abortEarly: false });
};

// Joi ולידציה להתחברות
userSchema.statics.validateLogin = (data) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  });

  return schema.validate(data, { abortEarly: false });
};

const User = mongoose.model('User', userSchema);
module.exports = User;