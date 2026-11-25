const express = require('express');
const router = express.Router();
const db = require('../database.js');
const bcrypt = require('bcrypt'); // Assuming you use bcrypt for passwords
const { randomUUID } = require('crypto');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// GET all users
router.get('/', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
    const result = await db.query('SELECT id, name, username, role, branch_id, created_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
}));

// POST create or update user
router.post('/', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
    const { id, name, username, password, role, branch_id } = req.body;
    
    if (id) {
        // Update
        let query = 'UPDATE users SET name = $1, username = $2, role = $3, branch_id = $4';
        let params = [name, username, role, branch_id || null];
        
        if (password) {
            const hash = await bcrypt.hash(password, 10);
            query += ', password_hash = $5 WHERE id = $6';
            params.push(hash, id);
        } else {
            query += ' WHERE id = $5';
            params.push(id);
        }
        await db.query(query, params);
    } else {
        // Create
        const hash = await bcrypt.hash(password, 10);
        const userId = randomUUID();
        await db.query(
            'INSERT INTO users (id, name, username, password_hash, role, branch_id) VALUES ($1, $2, $3, $4, $5, $6)',
            [userId, name, username, hash, role, branch_id || null]
        );
    }
    res.json({ success: true });
}));

// DELETE user
router.delete('/:id', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
    await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
}));

module.exports = router;