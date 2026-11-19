const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database.js');
const { getClientIp } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-production';

// POST /api/login
router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = await db.query('SELECT * FROM users WHERE LOWER(TRIM(username)) = LOWER(TRIM($1))', [username]);
  if (!user.rows.length) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = bcrypt.compareSync(password, user.rows[0].password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Dynamic IP restriction logic for staff
  if (user.rows[0].role === 'staff') {
    const ipSetting = await db.query("SELECT value FROM settings WHERE key = 'ip_restriction_enabled'");
    const isIpRestricted = ipSetting.rows.length ? (ipSetting.rows[0].value === 'true') : (process.env.ENABLE_IP_RESTRICTION === 'true');

    if (isIpRestricted) {
      const clientIp = getClientIp(req);
      const isLocal = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp.startsWith('192.168.') || clientIp.startsWith('10.');
      
      let allowedIps = [];
      const ipListSetting = await db.query("SELECT value FROM settings WHERE key = 'branch_allowed_ips'");
      if (ipListSetting.rows.length && ipListSetting.rows[0].value) {
        try {
          const parsed = JSON.parse(ipListSetting.rows[0].value);
          allowedIps = Array.isArray(parsed) ? parsed.map(item => typeof item === 'string' ? item.trim() : item.ip?.trim()).filter(Boolean) : [];
        } catch (_) {
          allowedIps = ipListSetting.rows[0].value.split(',').map(s => s.trim()).filter(Boolean);
        }
      }
      if (!allowedIps.length && process.env.BRANCH_ALLOWED_IPS) {
        allowedIps = process.env.BRANCH_ALLOWED_IPS.split(',').map(s => s.trim()).filter(Boolean);
      }

      if (!isLocal && allowedIps.length && !allowedIps.includes(clientIp)) {
        return res.status(403).json({ error: `Access denied. Your IP (${clientIp}) is not permitted at this branch.` });
      }
    }
  }

  const userBranchId = user.rows[0].branch_id || (user.rows[0].role === 'admin' ? null : 1);
  const token = jwt.sign(
    { id: user.rows[0].id, username: user.rows[0].username, role: user.rows[0].role, branch_id: userBranchId },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    role: user.rows[0].role,
    username: user.rows[0].username,
    name: user.rows[0].name,
    id: user.rows[0].id,
    branch_id: userBranchId
  });
}));

module.exports = router;