const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../database.js');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/users (Admin Only)
router.get('/', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  const result = await db.query('SELECT id, username, role, name, branch_id, created_at FROM users ORDER BY created_at DESC');
  res.json(result.rows);
}));

// POST /api/users (Admin Only - Create or Update)
router.post('/', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  const { id, username, password, role, name, branch_id } = req.body;
  if (!username || !role) return res.status(400).json({ error: 'Missing required fields' });
  
  if (id) {
    // Update existing user
    const fields = [];
    const vals = [];
    let idx = 1;
    fields.push(`username=$${idx++}`); vals.push(username);
    fields.push(`role=$${idx++}`); vals.push(role);
    if (name !== undefined) { fields.push(`name=$${idx++}`); vals.push(name); }
    if (branch_id !== undefined) { fields.push(`branch_id=$${idx++}`); vals.push(branch_id ? parseInt(branch_id) : null); }
    
    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      fields.push(`password=$${idx++}`); vals.push(hash);
    }
    
    vals.push(id);
    const setClause = fields.join(',');
    await db.query(`UPDATE users SET ${setClause} WHERE id=$${idx}`, vals);
  } else {
    // Create new user
    if (!password) return res.status(400).json({ error: 'Password is required for new users' });
    const newId = randomUUID();
    const hash = bcrypt.hashSync(password, 10);
    await db.query(
      'INSERT INTO users (id, username, password, role, name, branch_id) VALUES ($1,$2,$3,$4,$5,$6)',
      [newId, username, hash, role, name || null, branch_id ? parseInt(branch_id) : null]
    );
  }
  res.json({ success: true });
}));

// DELETE /api/users/:id (Admin Only)
router.delete('/:id', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.json({ success: true });
}));

module.exports = router;