const express = require('express');
const router = express.Router();
const db = require('../database.js');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

function getClientIp(req) {
    let clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
    if (clientIp.startsWith('::ffff:')) {
         clientIp.substring(7);
    }
    return clientIp;
}

// 1. Get General Settings
router.get('/ip-security', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
    const clientIp = getClientIp(req);
    const enabledRes = await db.query("SELECT value FROM settings WHERE key = 'ip_restriction_enabled'");
    const enabled = enabledRes.rows.length ? enabledRes.rows[0].value === 'true' : false;
    const listRes = await db.query("SELECT value FROM settings WHERE key = 'branch_allowed_ips'");
    let allowed_ips = [];
    if (listRes.rows.length && listRes.rows[0].value) {
        try {
            allowed_ips =JSON.parse(listRes.rows[0].value);
        } catch (_) {}
    }

    res.json({ enabled, current_ip: clientIp, allowed_ips });
}));

// 2. Save General Setting (e.g., WhatsApp Number)
router.post('/ip-security', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
    const { enabled, allowed_ips } = req.body;

    if (enabled !== undefined) {
    await db.query(`
        INSERT INTO settings (key, value) VALUES ('ip_restriction_enabled', $1)
        ON CONFLICT (key) DO UPDATE SET value = $1
    `, [enabled ? 'true' : 'false']
);
    }

    if (allowed_ips !== undefined) {
        await db.query(
            `INSERT INTO settings (key, value) VALUES ('branch_allowed_ips', $1)
            ON CONFLICT (key) DO UPDATE SET value = $1`,
            [JSON.stringify(allowed_ips)]
        );
    }

    res.json({ success: true });
}));


module.exports = router;