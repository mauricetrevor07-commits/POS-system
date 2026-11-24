const express = require('express');
const router = express.Router();
const db = require('../database.js');
const { authMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/branch
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const result = await db.query('SELECT id, name, location FROM branches ORDER BY id');
  
  res.json(result.rows);
}));

module.exports = router;