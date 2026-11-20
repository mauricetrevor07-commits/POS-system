const jwt = require('jsonwebtoken');
const JWT_SECRET = 'autopak-super-secret-key-2026';
function authMiddleware(req, res, next) {
    const token = req.headers['x-auth-token'] || req.headers['authorization']?.split('')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized. No token provided.'});

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        Req.user = decoded;
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

module.exports = { authMiddleware, adminOnly, getClientIp };