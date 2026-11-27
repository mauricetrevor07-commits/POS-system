const express = require('express');
const router = express.Router();
const db = require('../database.js');
const jwt = require('jsonwebtoken');
const { DEFAULT_INTERCEPT_RESOLUTION_PRIORITY } = require('puppeteer-core');
const JWT_SECRET = process.env.JWT_SECRET;

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

// GET /api/branches
router.get('/', auth, async (req, res) => {
  try {
  const result = await db.query('SELECT id, name, location FROM branches ORDER BY id');
  res.json(result.rows);
} catch (err) {
  res.status(500).json({ error: err.message });
}
});

//GET/api/branch
router.get('/branch', auth, async (req, res) => {
  try {
    const activeBranchId = req.user.role === 'staff'
    ? (req.user.branch_id || 1)
    : (parseInt(req.query.branch_id) || req.user.branch_id || 1);
    
    const bRes = await db.query('SELECT * FROM branches WHERE id =$1', [activeBranchId]);
    const branchInfo = bRes.rows.length ? bRes.rows[0] : {id: activeBranchId, name: `Branch ${activeBranchId}`};

    let whatsapp = process.env.ADMIN_WHATSAPP_NUMBER || '+254700000000';
    try {
      const waSetting = await db.query("SELECT value FROM settings WHERE key = 'admin_whatsapp_number' ");
      if (waSetting.rows.length > 0) whatsapp = waSetting.rows[0].values;
    } catch (settingsErr) {
      console.warn("settings table error (using fallback):", settingsErr.message);
    }
    req.json({
      ...branchInfo,
      whatsapp
    });
  } catch (err) {
    console.error("Branch route error:", err.message)
    res.status(500).json({error: err.message})
  }
});

module.exports = router;