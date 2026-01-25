const User = require('../models/user.model');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// פילטר לשדות מותרים בעדכון (חשוב מאוד!)
const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach(el => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.getAllUsers = catchAsync(async (req, res) => {
  // דוגמה פשוטה לפגינציה
  const page = req.query.page * 1 || 1;
  const limit = req.query.limit * 1 || 100;
  const skip = (page - 1) * limit;

  const users = await User.find()
    .select('-password -__v')
    .skip(skip)
    .limit(limit);

  const total = await User.countDocuments();

  res.status(200).json({
    status: 'success',
    results: users.length,
    totalUsers: total,
    data: { users }
  });
});

exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id).select('-password -__v');
  if (!user) return next(new AppError('משתמש לא נמצא', 404));
  
  res.status(200).json({ status: 'success', data: { user } });
});

exports.updateUser = catchAsync(async (req, res, next) => {
  // מותר לעדכן רק את השדות האלה!
  const filteredBody = filterObj(req.body, 'name', 'email', 'photo'); // הוסיפי מה שרלוונטי

  const user = await User.findByIdAndUpdate(req.params.id, filteredBody, {
    new: true,
    runValidators: true
  }).select('-password -__v');

  if (!user) return next(new AppError('משתמש לא נמצא', 404));

  res.status(200).json({ status: 'success', data: { user } });
});

exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) return next(new AppError('משתמש לא נמצא', 404));

  // soft delete לדוגמה (מומלץ יותר)
  user.isActive = false;
  await user.save();

  // או למחיקה מלאה: await User.findByIdAndDelete(req.params.id);

  res.status(204).json({ status: 'success', data: null });
});