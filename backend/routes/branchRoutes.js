const express = require('express');
const router = express.Router();
const db = require('../database.js');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;
const { authMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const auth = (req, res, next) => {
  try {
    const token = req.headers['x-auth-token'] || req.headers['authorisation']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'unathorized' });
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// GET /api/branch
router.get('/', auth, async (req, res) => {
  try {
  const result = await db.query('SELECT id, name, location FROM branches ORDER BY id');
  res.json(result.rows);
} catch (err) {
  res.status(500).json({ error: err.message });
}
});

module.exports = router;