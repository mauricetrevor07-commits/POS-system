const express = require('express');
const router = express.Router();
const db = require('../database.js');
const { authMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/branch
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const BRANCH_ID = parseInt(process.env.BRANCH_ID) || 1;
  
  const activeBranchId = req.user.role === 'staff'
    ? (req.user.branch_id || BRANCH_ID)
    : (parseInt(req.query.branch_id) || req.user.branch_id || BRANCH_ID);

  const bRes = await db.query('SELECT * FROM branches WHERE id = $1', [activeBranchId]);
  const branchInfo = bRes.rows.length ? bRes.rows[0] : { id: activeBranchId, name: `Branch ${activeBranchId}` };
  
  const waSetting = await db.query("SELECT value FROM settings WHERE key = 'admin_whatsapp_number'");
  const whatsapp = waSetting.rows.length ? waSetting.rows[0].value : (process.env.ADMIN_WHATSAPP_NUMBER || '+254700000000');
  
  res.json({
    ...branchInfo,
    whatsapp
  });
}));

// GET /api/branches (For admin to see all branches)
router.get('/all', authMiddleware, asyncHandler(async (req, res) => {
  const result = await db.query('SELECT * FROM branches ORDER BY id');
  res.json(result.rows);
}));

module.exports = router;