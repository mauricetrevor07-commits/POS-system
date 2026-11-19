const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database.js');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-production';

// POST /api/login
router.post('/login', async (req, res) => {
  try {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

module.exports = router; // 👈 THIS MUST BE THE LAST LINE