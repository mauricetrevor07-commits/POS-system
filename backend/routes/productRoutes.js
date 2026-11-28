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
    `SELECT p.*, COALESCE(bs.stock, 0)::real AS stock
     FROM products p
     LEFT JOIN branch_stock bs ON p.id = bs.product_id AND bs.branch_id = $1
     ORDER BY p.name`,
    [branchId]
  );
  res.json(result.rows);
}));

// POST /api/products (Create)
router.post('/', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  const id = randomUUID();
  const { name, price, wholesale_price, distributor_price, category, stock, barcode, attributes } = req.body;
  const targetBranch = req.user.branch_id || 1;
  const initialStock = parseFloat(stock) || 0;

  await db.query(
    `INSERT INTO products (id, name, price, wholesale_price, distributor_price, stock, category, barcode, attributes) 
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
    [id, name, parseFloat(price), wholesale_price, distributor_price, initialStock, category, barcode, JSON.stringify(attributes || {})]
  );

  const branches = await db.query("SELECT id FROM branches");
  for (const b of branches.rows) {
    const bStock = b.id === targetBranch ? initialStock : 0;
    await db.query(
      `INSERT INTO branch_stock (branch_id, product_id, stock) VALUES ($1, $2, $3)`,
      [b.id, id, bStock]
    );
  }

  res.status(201).json({ id, name, price, stock: initialStock });
}));

router.get('/categories', authMiddleware, asyncHandler(async (req, res) => {
  const result = await db.query('SELECT * FROM product_categories ORDER BY name');
  res.json(result.rows);
}));

router.post('/categories', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  const { name, attributes_schema } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Category name is required' });

  const result = await db.query(
    `INSERT INTO product_categories (name, attributes_schema)
    VALUES ($1, $2::jsonb)
    ON CONFLICT (name) DO UPDATE SET attributes_schema = EXCLUDED.attributes_schema
    RETURNING *`,
    [name.trim(), JSON.stringify(attributes_schema || [])]
  );
  res.status(201).json(result.rows[0]);
}));

router.delete('/categories/:id', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  await db.query('DELETE FROM product_categories WHERE id = $1', [req.params.id]);
  res.json({ success: true });
}));

// PUT /api/products/:id (Update)
router.put('/:id', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  const { name, price, wholesale_price, distributor_price, category, stock, barcode, attributes } = req.body;
  const targetBranch = req.user.branch_id || 1;

  await db.query(
    `UPDATE products 
     SET name=$1, price=$2, wholesale_price=$3, distributor_price=$4, category=$5, barcode=$6, attributes = $8::jsonb, updated_at=NOW() 
     WHERE id=$7`,
    [name, parseFloat(price), wholesale_price, distributor_price, category, barcode, req.params.id, JSON.stringify(attributes || {})]
  );

  if (stock !== undefined) {
    await db.query(
      `INSERT INTO branch_stock (branch_id, product_id, stock) VALUES ($1, $2, $3)
       ON CONFLICT (branch_id, product_id) DO UPDATE SET stock = $3`,
      [targetBranch, req.params.id, parseFloat(stock)]
    );
    // Keep master stock in sync for the primary branch
    if (targetBranch === 1) {
      await db.query(`UPDATE products SET stock = $1 WHERE id = $2`, [parseFloat(stock), req.params.id]);
    }
  }

  res.json({ success: true });
}));

// DELETE /api/products/:id
router.delete('/:id', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  await db.query('DELETE FROM branch_stock WHERE product_id = $1', [req.params.id]);
  await db.query('DELETE FROM products WHERE id = $1', [req.params.id]);
  res.json({ success: true });
}));

// POST /api/products/bulk-tier-prices
router.post('/bulk-tier-prices', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  const { updates } = req.body;
  if (!updates || !updates.length) return res.status(400).json({ error: 'No updates' });

  for (const u of updates) {
    await db.query(
      `UPDATE products 
       SET price=$1, wholesale_price=$2, distributor_price=$3, updated_at=NOW() 
       WHERE id=$4`,
      [u.price, u.wholesale_price, u.distributor_price, u.id]
    );
  }
  res.json({ success: true, updatedCount: updates.length });
}));

// POST /api/products/import-stock
router.post('/import-stock', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
  const { items } = req.body;
  const targetBranch = req.user.branch_id || 1;
  
  for (const item of items) {
    await db.query(
      `INSERT INTO branch_stock (branch_id, product_id, stock) VALUES ($1, $2, $3)
       ON CONFLICT (branch_id, product_id) DO UPDATE SET stock = branch_stock.stock + $3`,
      [targetBranch, item.id, item.stock_to_add]
    );
    await db.query(`UPDATE products SET stock = stock + $1 WHERE id = $2`, [item.stock_to_add, item.id]);
  }
  
  res.json({ success: true, updatedCount: items.length });
}));

module.exports = router;