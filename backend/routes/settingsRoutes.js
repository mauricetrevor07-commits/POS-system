const express = require('express');
const router = express.Router();
const db = require('../database.js');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// 1. Get General Settings
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
    const result = await db.query('SELECT key, value FROM settings');
    const settings = {};
    result.rows.forEach(row => { settings[row.key] = row.value; });
    res.json(settings);
}));

// 2. Save General Setting (e.g., WhatsApp Number)
router.post('/', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
    const { key, value } = req.body;
    await db.query(`
        INSERT INTO settings (key, value) VALUES ($1, $2)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `, [key, value]);
    res.json({ success: true });
}));

// 3. Get IP Security Settings
router.get('/ip-security', authMiddleware, asyncHandler(async (req, res) => {
    const ipResult = await db.query(`SELECT value FROM settings WHERE key = 'ip_restriction_enabled'`);
    const listResult = await db.query(`SELECT value FROM settings WHERE key = 'allowed_ips'`);
    
    let allowed_ips = [];
    let enabled = false;
    
    if (ipResult.rows.length) enabled = ipResult.rows[0].value === 'true';
    if (listResult.rows.length) {
        try { allowed_ips = JSON.parse(listResult.rows[0].value); } catch (_) {}
    }

    res.json({
        client_ip: req.ip,
        enabled,
        allowed_ips
    });
}));

// 4. Save IP Security Settings
router.post('/ip-security', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
    const { enabled, allowed_ips } = req.body;
    
    await db.query(`INSERT INTO settings (key, value) VALUES ('ip_restriction_enabled', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [enabled.toString()]);
    await db.query(`INSERT INTO settings (key, value) VALUES ('allowed_ips', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(allowed_ips)]);

    res.json({ success: true });
}));

// 5. Apply Category Pricing
router.post('/apply-category-pricing', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
    const { category, wholesale_discount_pct, distributor_discount_pct } = req.body;
    
    const result = await db.query(`
        UPDATE products 
        SET wholesale_price = price * (1 - $1::numeric / 100),
            distributor_price = price * (1 - $2::numeric / 100)
        WHERE category = $3 OR $3 = 'General'
        RETURNING id
    `, [wholesale_discount_pct, distributor_discount_pct, category]);

    res.json({ success: true, updatedProductsCount: result.rowCount });
}));

module.exports = router;