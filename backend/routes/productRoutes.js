const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const db = require('../database.js');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/products
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const isStaff = req.user.role === 'staff';
  const branchId = isStaff ? (req.user.branch_id || 1) : (parseInt(req.query.branch_id) || req.user.branch_id || 1);

  const result = await db.query(
    `SELECT p.*, COALESCE(bs.stock, 0)::real AS stock, COALESCE(bs.stock, 0)::real AS branch_stock
     FROM products p
     LEFT JOIN branch_stock bs ON p.id = bs.product_id AND bs.branch_id = $1
     ORDER BY p.name`,
    [branchId]
  );
  res.json(result.rows);
}));

// POST /api/products (Admin Only)
router.post('/', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  const id = randomUUID();
  const { name, price, wholesale_price, distributor_price, barcode, category, stock, branch_id } = req.body;
  const initialStock = parseFloat(stock) || 0;
  const targetBranch = parseInt(branch_id) || 1;

  await db.query(
    `INSERT INTO products (id, name, price, wholesale_price, distributor_price, stock, barcode, category) 
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      id, name, parseFloat(price) || 0,
      wholesale_price !== undefined && wholesale_price !== null && wholesale_price !== '' ? parseFloat(wholesale_price) : null,
      distributor_price !== undefined && distributor_price !== null && distributor_price !== '' ? parseFloat(distributor_price) : null,
      initialStock, barcode || null, category || null
    ]
  );

  // Initialize branch_stock
  const branches = await db.query("SELECT id FROM branches");
  for (const b of branches.rows) {
    const bStock = b.id === targetBranch ? initialStock : 0;
    await db.query(
      `INSERT INTO branch_stock (branch_id, product_id, stock) VALUES ($1, $2, $3)
       ON CONFLICT (branch_id, product_id) DO UPDATE SET stock = $3`,
      [b.id, id, bStock]
    );
  }

  res.status(201).json({ id, ...req.body, stock: initialStock });
}));

// PUT /api/products/:id (Admin Only)
router.put('/:id', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  const allowed = ['name','price','wholesale_price','distributor_price','stock','barcode','category'];
  const data = {};
  
  allowed.forEach(k => {
    if (req.body[k] !== undefined) {
      if (k === 'price' || k === 'wholesale_price' || k === 'distributor_price' || k === 'stock') {
        data[k] = req.body[k] !== '' && req.body[k] !== null ? parseFloat(req.body[k]) : null;
      } else {
        data[k] = req.body[k];
      }
    }
  });

  if (Object.keys(data).length) {
    const set = Object.keys(data).map((k, i) => `"${k}"=$${i+1}`).join(',');
    const vals = Object.values(data);
    await db.query(`UPDATE products SET ${set}, updated_at=NOW() WHERE id=$${vals.length+1}`, [...vals, req.params.id]);

    if (data.stock !== undefined && data.stock !== null) {
      const targetBranch = parseInt(req.body.branch_id) || 1;
      await db.query(
        `INSERT INTO branch_stock (branch_id, product_id, stock) VALUES ($1, $2, $3)
         ON CONFLICT (branch_id, product_id) DO UPDATE SET stock = $3`,
        [targetBranch, req.params.id, data.stock]
      );
    }
  }
  res.json({ success: true });
}));

// DELETE /api/products/:id (Admin Only)
router.delete('/:id', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  await db.query('DELETE FROM branch_stock WHERE product_id = $1', [req.params.id]);
  await db.query('DELETE FROM products WHERE id=$1', [req.params.id]);
  res.json({ success: true });
}));

module.exports = router;