const express = require('express');
const router = express.Router();
const db = require('../database/js');
const { authMiddleWare } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

router.get('/pending-count', authMiddleWare, asyncHandler(async (req, res) => {
    if (req.user.role !== 'admin') return res.json({ count: 0 });
    const result = await db.query(`SELECT COUNT(*) FROM sales WHERE payment_status = 'pending_payment'`);
    res.json({ count: parseInt(result.rows[0].count) });
}));

module.exports = router;