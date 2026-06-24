require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const { randomUUID } = require('crypto');
const db = require('./database.js');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'renderer')));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', apiLimiter);

const AUTH_TOKEN = process.env.AUTH_TOKEN;
const BRANCH_ID = parseInt(process.env.BRANCH_ID) || 1;

function authMiddleware(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (token !== AUTH_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ─── Branch Info ──────────────────────────
app.get('/api/branch', authMiddleware, (req, res) => {
  res.json({ id: BRANCH_ID, name: process.env.BRANCH_NAME || `Branch ${BRANCH_ID}` });
});

// ─── Products (local mirror of central) ───
const productFields = ['name', 'price', 'stock', 'barcode', 'category'];

app.get('/api/products', authMiddleware, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM products ORDER BY name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/products', authMiddleware, async (req, res) => {
  try {
    const id = randomUUID();
    const { name, price, barcode, category, stock } = req.body;
    await db.query(
      `INSERT INTO products (id, name, price, stock, barcode, category) VALUES (?,?,?,?,?,?)`,
      [id, name, price, stock || 0, barcode || null, category || null]
    );
    res.status(201).json({ id, ...req.body, stock: stock || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/products/:id', authMiddleware, async (req, res) => {
  try {
    const allowed = ['name','price','stock','barcode','category'];
    const data = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
    if (Object.keys(data).length) {
      const set = Object.keys(data).map(k => `${k}=?`).join(',');
      const vals = Object.values(data);
      await db.query(`UPDATE products SET ${set}, updated_at=datetime('now','localtime') WHERE id=?`, [...vals, req.params.id]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/products/:id', authMiddleware, async (req, res) => {
  try {
    await db.query('DELETE FROM products WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Customers ────────────────────────────
app.get('/api/customers', authMiddleware, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM customers ORDER BY name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/customers', authMiddleware, async (req, res) => {
  try {
    const id = randomUUID();
    const { name, contact_person, phone, email, address } = req.body;
    await db.query(
      `INSERT INTO customers (id, name, contact_person, phone, email, address) VALUES (?,?,?,?,?,?)`,
      [id, name, contact_person || null, phone || null, email || null, address || null]
    );
    res.status(201).json({ id, ...req.body });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/customers/:id', authMiddleware, async (req, res) => {
  try {
    const allowed = ['name','contact_person','phone','email','address'];
    const data = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
    if (Object.keys(data).length) {
      const set = Object.keys(data).map(k => `${k}=?`).join(',');
      const vals = Object.values(data);
      await db.query(`UPDATE customers SET ${set}, updated_at=datetime('now','localtime') WHERE id=?`, [...vals, req.params.id]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Customer prices
app.get('/api/customer-prices/:customerId', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT cp.*, p.name AS product_name
       FROM customer_prices cp
       JOIN products p ON cp.product_id = p.id
       WHERE cp.customer_id = ?`,
      [req.params.customerId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/customer-prices', authMiddleware, async (req, res) => {
  try {
    const id = randomUUID();
    const { customer_id, product_id, custom_price } = req.body;
    await db.query(
      `INSERT INTO customer_prices (id, customer_id, product_id, custom_price) VALUES (?,?,?,?)
       ON CONFLICT(customer_id, product_id) DO UPDATE SET custom_price = ?`,
      [id, customer_id, product_id, custom_price, custom_price]
    );
    res.status(201).json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Sales (offline-capable, sync-aware) ──
app.post('/api/sales', authMiddleware, async (req, res) => {
  try {
    const { items, paymentMethod = 'cash', customer_id } = req.body;
    if (!items || !items.length) return res.status(400).json({ error: 'Cart empty' });

    let total = 0;
    for (const item of items) {
      const prod = await db.query('SELECT * FROM products WHERE id=?', [item.productId]);
      if (!prod.rows.length) return res.status(404).json({ error: `Product ${item.productId} not found` });
      const product = prod.rows[0];
      if (product.stock < item.quantity) return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
      total += product.price * item.quantity;
    }

    const saleId = randomUUID();
    await db.query(
      `INSERT INTO sales (id, branch_id, customer_id, total, paymentMethod, status) VALUES (?,?,?,?,?,'pending_sync')`,
      [saleId, BRANCH_ID, customer_id || null, total, paymentMethod]
    );

    for (const item of items) {
      const prod = await db.query('SELECT * FROM products WHERE id=?', [item.productId]);
      const p = prod.rows[0];
      await db.query(
        `INSERT INTO sale_items (saleId, productId, productName, quantity, price) VALUES (?,?,?,?,?)`,
        [saleId, p.id, p.name, item.quantity, p.price]
      );
      // Optimistic local stock deduction (sync will correct if rejected)
      await db.query('UPDATE products SET stock = stock - ? WHERE id=?', [item.quantity, p.id]);
    }

    res.status(201).json({ id: saleId, total, paymentMethod, timestamp: new Date().toISOString(), status: 'pending_sync' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get sales (all statuses)
app.get('/api/sales', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.id, s.timestamp, s.total, s.paymentMethod, s.status, s.branch_id,
             c.name AS customer_name,
             si.productName, si.quantity, si.price
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN sale_items si ON s.id = si.saleId
      WHERE s.branch_id = ?
      ORDER BY s.timestamp DESC
    `, [BRANCH_ID]);
    const sales = [];
    const map = new Map();
    for (const row of result.rows) {
      if (!map.has(row.id)) {
        map.set(row.id, {
          id: row.id,
          timestamp: row.timestamp,
          total: row.total,
          paymentMethod: row.paymentMethod,
          status: row.status,
          customer_name: row.customer_name,
          items: []
        });
      }
      if (row.productName) {
        map.get(row.id).items.push({
          productName: row.productName,
          quantity: row.quantity,
          price: row.price
        });
      }
    }
    res.json(Array.from(map.values()));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Internal Sync Helper Routes (used by frontend sync.js) ───
app.get('/api/sync/pending-sales', authMiddleware, async (req, res) => {
  try {
    const sales = await db.query("SELECT * FROM sales WHERE branch_id=? AND status='pending_sync'", [BRANCH_ID]);
    const result = [];
    for (const sale of sales.rows) {
      const items = await db.query("SELECT * FROM sale_items WHERE saleId=?", [sale.id]);
      result.push({ ...sale, items: items.rows });
    }
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/sync/pending-products', authMiddleware, async (req, res) => {
  try {
    // We mark products that haven't been synced yet. Simplified: assume all new ones are pending.
    // You could use a flag, but for now we send all. Sync server will upsert.
    const products = await db.query("SELECT * FROM products");
    res.json(products.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/sync/pending-customers', authMiddleware, async (req, res) => {
  try {
    const customers = await db.query("SELECT * FROM customers");
    res.json(customers.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/sync/upsert-product', authMiddleware, async (req, res) => {
  const p = req.body;
  await db.query(`
    INSERT INTO products (id, name, price, stock, barcode, category, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, price=excluded.price, stock=excluded.stock,
      barcode=excluded.barcode, category=excluded.category,
      updated_at=excluded.updated_at
  `, [p.id, p.name, p.price, p.stock, p.barcode, p.category, p.created_at, p.updated_at]);
  res.json({ success: true });
});

app.post('/api/sync/upsert-customer', authMiddleware, async (req, res) => {
  const c = req.body;
  await db.query(`
    INSERT INTO customers (id, name, contact_person, phone, email, address, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, contact_person=excluded.contact_person,
      phone=excluded.phone, email=excluded.email, address=excluded.address,
      updated_at=excluded.updated_at
  `, [c.id, c.name, c.contact_person, c.phone, c.email, c.address, c.created_at, c.updated_at]);
  res.json({ success: true });
});

app.post('/api/sync/update-stock', authMiddleware, async (req, res) => {
  const { product_id, stock } = req.body; // absolute stock value
  await db.query('UPDATE products SET stock = ?, updated_at=datetime(\'now\',\'localtime\') WHERE id=?', [stock, product_id]);
  res.json({ success: true });
});

app.put('/api/sync/sale-status/:id', authMiddleware, async (req, res) => {
  const { status, error } = req.body;
  await db.query(`UPDATE sales SET status=?, sync_error=? WHERE id=?`, [status, error || null, req.params.id]);
  res.json({ success: true });
});

app.post('/api/sync/remap-id', authMiddleware, async (req, res) => {
  // If central server assigned a different ID, remap locally (rare with UUIDs)
  const { local_id, server_id } = req.body;
  // Update references in sale_items etc.
  res.json({ success: true });
});

app.get('/api/sync/status', authMiddleware, async (req, res) => {
  const row = await db.query('SELECT * FROM sync_log LIMIT 1');
  res.json(row.rows[0]);
});

app.post('/api/sync/update-pull-timestamp', authMiddleware, async (req, res) => {
  await db.query('UPDATE sync_log SET last_pull_timestamp=? WHERE id=1', [req.body.timestamp]);
  res.json({ success: true });
});

// ─── Serve Frontend ───────────────────────
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'renderer', 'index.html'));
});

// Start
const start = async () => {
  await db.init();
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, '0.0.0.0', () => console.log(`POS server running on port ${PORT} – Branch ${BRANCH_ID}`));
};
start();