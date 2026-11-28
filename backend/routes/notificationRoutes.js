const express = require('express');
const router = express.Router();
const db = require('../database.js');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

router.get('/pending-count', async (req, res) => {
    try {
        const token = req.headers['x-auth-token'] || req.headers['authorization']?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'admin') return res.json({ count: 0, transfer_count:0});
        const [salesRes, transferRes] = await Promise.all([
            db.query(`SELECT COUNT(*)::int AS count FROM sales WHERE payment_status = 'pending_payment'`),
            db.query(`SELECT COUNT(*)::int AS count FROM transfers WHERE status IN ('received', 'cancelled') AND admin_seen = false`)
        ]);
        
        res.json({
             count: salesRes.rows[0].count,
            transfer_count: transferRes.rows[0].count
         });
} catch (err) {
    res.status(401).json({ error:' Invalid token'});
}
});

module.exports = router;