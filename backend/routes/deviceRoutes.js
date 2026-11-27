const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../database.js');
const {
  authMiddleware,
  adminOnly,
  deviceGate,
  hashDeviceToken,
  DEVICE_COOKIE_NAME
} = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const enrollLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Too many enrollment attempts. Please wait 15 minutes.' }
});

// 1. Enroll this browser with a one-time code (NO authMiddleware - this is the gate)
router.post('/enroll', enrollLimiter, asyncHandler(async (req, res) => {
  const code = (req.body.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Enrollment code is required.' });

  const codeRes = await db.query(
    `SELECT * FROM device_enrollment_codes
     WHERE code = $1 AND used_at IS NULL AND expires_at > NOW()`,
    [code]
  );

  if (!codeRes.rows.length) {
    return res.status(400).json({ error: 'Invalid or expired enrollment code.' });
  }

  const record = codeRes.rows[0];
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashDeviceToken(rawToken);

  await db.query('UPDATE device_enrollment_codes SET used_at = NOW() WHERE id = $1', [record.id]);
  await db.query(
    `INSERT INTO authorized_devices (device_label, branch_id, token_hash)
     VALUES ($1, $2, $3)`,
    [record.device_label, record.branch_id, tokenHash]
  );

  res.cookie(DEVICE_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
  });

  res.json({ success: true, device_label: record.device_label });
}));

// 2. List all devices (Admin in Settings)
router.get('/', deviceGate, authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  const result = await db.query(
    `SELECT d.id, d.device_label, d.branch_id, b.name AS branch_name,
            d.is_active, d.last_seen_at, d.enrolled_at, d.revoked_at
     FROM authorized_devices d
     LEFT JOIN branches b ON b.id = d.branch_id
     ORDER BY d.is_active DESC, d.enrolled_at DESC`
  );

  const devices = result.rows.map(d => ({
    ...d,
    is_current: d.id === req.device.id
  }));

  res.json({ devices });
}));

// 3. Generate a 1-time enrollment code (Admin in Settings, requires password)
router.post('/codes', deviceGate, authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  const { branch_id, device_label, admin_password } = req.body;
  if (!device_label || !admin_password) {
    return res.status(400).json({ error: 'Terminal name and admin password are required.' });
  }

  const userRes = await db.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
  if (!userRes.rows.length || !bcrypt.compareSync(admin_password, userRes.rows[0].password)) {
    return res.status(403).json({ error: 'Incorrect admin password.' });
  }

  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
  const code = `POS-${randomPart}`;

  const insertRes = await db.query(
    `INSERT INTO device_enrollment_codes (code, branch_id, device_label, created_by, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '15 minutes')
     RETURNING code, expires_at`,
    [code, branch_id || null, device_label.trim(), req.user.id]
  );

  res.json(insertRes.rows[0]);
}));

// 4. Revoke a device (Admin in Settings, requires password)
router.patch('/:id/revoke', deviceGate, authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  const { admin_password } = req.body;

  if (!admin_password) {
    return res.status(400).json({ error: 'Admin password is required to revoke a terminal.' });
  }
  if (targetId === req.device.id) {
    return res.status(400).json({ error: 'You cannot revoke the terminal you are currently using.' });
  }

  const userRes = await db.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
  if (!userRes.rows.length || !bcrypt.compareSync(admin_password, userRes.rows[0].password)) {
    return res.status(403).json({ error: 'Incorrect admin password.' });
  }

  await db.query(
    `UPDATE authorized_devices
     SET is_active = false, revoked_at = NOW()
     WHERE id = $1`,
    [targetId]
  );

  res.json({ success: true });
}));

module.exports = router;