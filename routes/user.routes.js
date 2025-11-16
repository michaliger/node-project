const express = require('express');
const {
  getAllUsers,
  getUser,
  updateUser,
  deleteUser
} = require('../controllers/user.controller');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// הגנה: רק אדמין רואה הכל
router.use(protect);
router.use(restrictTo('admin'));

// GET    /api/users
router.get('/', getAllUsers);

// GET    /api/users/60d7...
router.get('/:id', getUser);

// PATCH  /api/users/60d7...
router.patch('/:id', updateUser);

// DELETE /api/users/60d7...
router.delete('/:id', deleteUser);

module.exports = router;