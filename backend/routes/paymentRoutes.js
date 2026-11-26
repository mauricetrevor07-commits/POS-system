const express = require('express');
const router = express.Router();
const db = require('../database.js');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'autopak-super-secret-key-2026';

const requireAdmin = (req, res, next) => {
  try {
    const token = req.headers['x-auth-token'] || req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// GET /api/payments/pending
router.get('/pending', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.*, c.name AS customer_name, b.name AS branch_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN branches b ON s.branch_id = b.id
      WHERE s.payment_status = 'pending_payment'
      ORDER BY s.timestamp DESC
    `);

    for (let sale of result.rows) {
      // FIXED: changed "saleId" to saleid
      const items = await db.query('SELECT * FROM sale_items WHERE saleid = $1', [sale.id]);
      sale.items = items.rows;
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/payments/credit-alerts (ADDED MISSING ROUTE)
router.get('/credit-alerts', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.*, c.name AS customer_name, c.phone AS customer_phone
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.paymentMethod = 'credit' AND s.payment_status != 'rejected' AND s.status != 'settled'
      ORDER BY s.due_date ASC
    `);
    res.json({ all: result.rows, overdue_count: 0, due_today_count: 0 }); 
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/payments/:id/approve
router.put('/:id/approve', requireAdmin, async (req, res) => {
  const saleId = req.params.id;
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    const saleRes = await client.query('SELECT * FROM sales WHERE id = $1 AND payment_status = $2 FOR UPDATE', [saleId, 'pending_payment']);
    if (!saleRes.rows.length) throw new Error('Sale not found or already processed');
    
    const sale = saleRes.rows[0];
    // FIXED: changed "saleId" to saleid
    const items = await client.query('SELECT * FROM sale_items WHERE saleid = $1', [saleId]);
    
    for (let item of items.rows) {
      await client.query(
        `UPDATE branch_stock SET stock = stock - $1 WHERE branch_id = $2 AND product_id = $3`,
        [item.quantity, sale.branch_id, item.productid] // Note: productid lowercase
      );
    }

    await client.query(`UPDATE sales SET payment_status = 'approved' WHERE id = $1`, [saleId]);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Payment approved' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/payments/:id/reject
router.put('/:id/reject', requireAdmin, async (req, res) => {
  try {
    await db.query(`UPDATE sales SET payment_status = 'rejected' WHERE id = $1 AND payment_status = 'pending_payment'`, [req.params.id]);
    res.json({ success: true, message: 'Payment rejected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;