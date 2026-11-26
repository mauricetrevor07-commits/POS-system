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
        if (decoded.role !== 'admin') return res.json({ count: 0});
        const result = await db.query(`SELECT COUNT(*) FROM sales WHERE payment_status = 'pending_payment'`);
        res.json({ count: parseInt(result.rows[0].count) });
} catch (err) {
    res.status(401).json({ error:' Invalid token'});
}
});

module.exports = router;