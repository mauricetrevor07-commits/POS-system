const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../database.js')

const JWT_SECRET = process.env.JWT_SECRET;
const DEVICE_COOKIE_NAME = 'autopak_device';

function hashDeviceToken(rawToken) {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function parseCookies(req) {
    const header = req.headers.cookie;
    if (!header) return{};
    return header.split(';').reduce((acc, part) => {
        const idx = part.indexOf('=');
        if (idx > -1) {
            const k = part.slice(0, idx).trim();
            const v = decodeURIComponent(part.slice(idx + 1).trim());
            acc[k] = v;
        }
        return acc;
}, {});
}

async function getAuthorizedDevice(req) {
    const cookies = parseCookies(req);
    const rawToken = cookies[DEVICE_COOKIE_NAME];
    if (!rawToken) return null;

    const tokenHash = hashDeviceToken(rawToken);
    const res = await db.query(
        `SELECT id, device_label, branch_id
        FROM authorized_devices
        WHERE token_hash = $1 AND is_active = true`,
        [tokenHash]
    );
    if (!res.rows.length) return null;

    db.query('update authorized_devices SET last_seen_at = NOW() WHERE id = $1', [res.rows[0].id]).catch(() => {});
    return res.rows[0];
}

async function deviceGate(req, res, next) {
    try {
        const device = await getAuthorizedDevicer(req);
        if (!device) {
            res.clearCookie(DEVICE_COOKIE_NAME, {path: '/'});
            return res.status(403).json({
                error: 'This terminal is not authorized. Enter an enrollment code to continue.',
                code: 'DEVICE_NOT_AUTHORIZED'
            });
        }
        req.device = device;
        next();
    } catch (err) {
        next(err);
    }
}

function authMiddleware(req, res, next) {
    const token = req.headers['x-auth-token'] || req.headers['authorization']?.split('')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized. No token provided.'});

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({error: 'Invalid or expired token.'});
    }
}

function adminOnly(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admin privileges requied.'});
    }
    next()
}

function getClientIp(req) {
    let clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
    if (clientIp.startsWith('::ffff:')) clientIp = clientIp.substring(7);
    return clientIp;
}

module.exports = { 
    authMiddleware,
    adminOnly,
    getClientIp,
    deviceGate,
    getAuthorizedDevice,
    hashDeviceToken,
    DEVICE_COOKIE_NAME
 };