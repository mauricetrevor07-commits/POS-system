require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database.js');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'renderer')));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', apiLimiter);

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-production';
const BRANCH_ID = parseInt(process.env.BRANCH_ID) || 1;

// ─── Authentication Middleware ──────────
function authMiddleware(req, res, next) {
  const token = req.headers['x-auth-token'] || req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

// ─── Login ─────────────────────────────
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (!user.rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = bcrypt.compareSync(password, user.rows[0].password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    // ─── Location Check for Staff ─────────────────
    if (user.rows[0].role === 'staff') {
      const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                       req.socket.remoteAddress;

      const allowedIPs = (process.env.BRANCH_ALLOWED_IPS || '127.0.0.1,::1,::ffff:127.0.0.1')
                          .split(',')
                          .map(ip => ip.trim());

      if (!allowedIPs.includes(clientIp)) {
        return res.status(403).json({
          error: 'Access denied. You must be at the branch location to log in.'
        });
      }
    }
    // ─────────────────────────────────────────────

    const token = jwt.sign(
      { id: user.rows[0].id, username, role: user.rows[0].role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, role: user.rows[0].role, username, id: user.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Users (Admin Only) ────────────────
app.get('/api/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await db.query('SELECT id, username, role, name, branch_id, created_at FROM users');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id, username, password, role, name, branch_id } = req.body;
    if (!username || !role) return res.status(400).json({ error: 'Missing required fields' });
    
    if (id) {
      if (password) {
        const hash = bcrypt.hashSync(password, 10);
        await db.query('UPDATE users SET username=?, password=?, role=?, name=?, branch_id=? WHERE id=?', [username, hash, role, name, branch_id, id]);
      } else {
        await db.query('UPDATE users SET username=?, role=?, name=?, branch_id=? WHERE id=?', [username, role, name, branch_id, id]);
      }
    } else {
      const newId = crypto.randomUUID();
      const hash = bcrypt.hashSync(password || '123456', 10);
      await db.query('INSERT INTO users (id, username, password, role, name, branch_id) VALUES (?, ?, ?, ?, ?, ?)', [newId, username, hash, role, name, branch_id]);
    }
    db.flush();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    db.flush();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Branch Info ────────────────────────
app.get('/api/branch', authMiddleware, async (req, res) => {
  try {
    const waSetting = await db.query("SELECT value FROM settings WHERE key = 'admin_whatsapp_number'");
    const whatsapp = waSetting.rows.length ? waSetting.rows[0].value : (process.env.ADMIN_WHATSAPP_NUMBER || '+254700000000');
    res.json({
      id: BRANCH_ID,
      name: process.env.BRANCH_NAME || `Branch ${BRANCH_ID}`,
      whatsapp
    });
  } catch (err) {
    res.json({
      id: BRANCH_ID,
      name: process.env.BRANCH_NAME || `Branch ${BRANCH_ID}`,
      whatsapp: process.env.ADMIN_WHATSAPP_NUMBER || '+254700000000'
    });
  }
});

// ─── Settings (admin only) ──────────────
app.get('/api/settings', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM settings');
    const settings = {};
    result.rows.forEach(row => { settings[row.key] = row.value; });
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/settings', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ error: 'Key is required' });
    await db.query(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = ?`,
      [key, value, value]
    );
    db.flush();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Products ──────────────────────────
app.get('/api/products', authMiddleware, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM products ORDER BY name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/products/:id', authMiddleware, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
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

// ─── Customers ─────────────────────────
app.get('/api/customers', authMiddleware, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM customers ORDER BY name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/customers/:id', authMiddleware, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Customer not found' });
    res.json(result.rows[0]);
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

// ─── Customer Prices ────────────────────
app.get('/api/customer-prices/:customerId', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT cp.*, p.name AS product_name FROM customer_prices cp JOIN products p ON cp.product_id = p.id WHERE cp.customer_id = ?`,
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

// ─── Sales (pending payment) ────────────
app.post('/api/sales', authMiddleware, async (req, res) => {
  try {
    const { items, paymentMethod, customer_id, payment_reference } = req.body;
    if (!items || !items.length) return res.status(400).json({ error: 'Cart empty' });
    const allowedMethods = ['mobile_money','bank_transfer','cheque'];
    if (!allowedMethods.includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }
    if (!payment_reference) return res.status(400).json({ error: 'Payment reference required' });

    let total = 0;
    for (const item of items) {
      const prod = await db.query('SELECT * FROM products WHERE id=?', [item.productId]);
      if (!prod.rows.length) return res.status(404).json({ error: `Product ${item.productId} not found` });
      const product = prod.rows[0];
      if (product.stock < item.quantity) return res.status(400).json({ error: `Insufficient stock for ${product.name}` });

      // Apply customer-specific price if exists
      let price = product.price;
      if (customer_id) {
        const custPrice = await db.query('SELECT custom_price FROM customer_prices WHERE customer_id=? AND product_id=?', [customer_id, item.productId]);
        if (custPrice.rows.length) price = custPrice.rows[0].custom_price;
      }
      total += price * item.quantity;
    }

    const saleId = randomUUID();
    await db.query(
      `INSERT INTO sales (id, branch_id, customer_id, total, paymentMethod, payment_reference, payment_status, status, created_by)
       VALUES (?,?,?,?,?,?,'pending_payment','completed',?)`,
      [saleId, BRANCH_ID, customer_id || null, total, paymentMethod, payment_reference, req.user.username]
    );

    for (const item of items) {
      const prod = await db.query('SELECT * FROM products WHERE id=?', [item.productId]);
      const p = prod.rows[0];
      let price = p.price;
      if (customer_id) {
        const custPrice = await db.query('SELECT custom_price FROM customer_prices WHERE customer_id=? AND product_id=?', [customer_id, item.productId]);
        if (custPrice.rows.length) price = custPrice.rows[0].custom_price;
      }
      await db.query(
        `INSERT INTO sale_items (saleId, productId, productName, quantity, price) VALUES (?,?,?,?,?)`,
        [saleId, item.productId, p.name, item.quantity, price]
      );
      await db.query(`UPDATE products SET stock = stock - ? WHERE id = ?`, [item.quantity, item.productId]);
    }
    db.flush();

    res.status(201).json({ id: saleId, total, paymentMethod, payment_status: 'pending_payment', message: 'Payment pending admin approval' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Pending Payments (admin only) ─────
app.get('/api/pending-payments', authMiddleware, adminOnly, async (req, res) => {
  try {
    const sales = await db.query(`
      SELECT s.*, c.name AS customer_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.payment_status = 'pending_payment'
      ORDER BY s.timestamp DESC
    `);
    for (let sale of sales.rows) {
      const items = await db.query('SELECT * FROM sale_items WHERE saleId = ?', [sale.id]);
      sale.items = items.rows;
    }
    res.json(sales.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/payments/:saleId/approve', authMiddleware, adminOnly, async (req, res) => {
  try {
    const sale = await db.query('SELECT * FROM sales WHERE id = ?', [req.params.saleId]);
    if (!sale.rows.length) return res.status(404).json({ error: 'Sale not found' });
    // Deduct stock
    const items = await db.query('SELECT * FROM sale_items WHERE saleId = ?', [req.params.saleId]);
    for (const item of items.rows) {
      await db.query('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.productId]);
    }
    await db.query("UPDATE sales SET payment_status = 'approved' WHERE id = ?", [req.params.saleId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/payments/:saleId/reject', authMiddleware, adminOnly, async (req, res) => {
  try {
    await db.query("UPDATE sales SET payment_status = 'rejected' WHERE id = ?", [req.params.saleId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Sales History ─────────────────────
app.get('/api/sales', authMiddleware, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    let sql = `SELECT s.*, c.name AS customer_name FROM sales s LEFT JOIN customers c ON s.customer_id = c.id`;
    if (!isAdmin) {
      sql += " WHERE s.payment_status = 'approved'";
    }
    sql += " ORDER BY s.timestamp DESC";
    const sales = await db.query(sql);
    const saleIds = sales.rows.map(s => s.id);
    let items = [];
    if (saleIds.length > 0) {
      const placeholders = saleIds.map(() => '?').join(',');
      items = (await db.query(`SELECT * FROM sale_items WHERE saleId IN (${placeholders})`, saleIds)).rows;
    }
    const grouped = {};
    items.forEach(i => {
      if (!grouped[i.saleId]) grouped[i.saleId] = [];
      grouped[i.saleId].push(i);
    });
    const result = sales.rows.map(s => ({ ...s, items: grouped[s.id] || [] }));
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Reports (admin only) ──────────────
app.get('/api/reports/sales-summary', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { from, to } = req.query;
    let sql = `SELECT COUNT(*) AS total_sales, SUM(total) AS total_amount FROM sales WHERE payment_status = 'approved'`;
    const params = [];
    if (from) { sql += ' AND timestamp >= ?'; params.push(from); }
    if (to)   { sql += ' AND timestamp <= ?'; params.push(to); }
    const result = await db.query(sql, params);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Transfers (unchanged) ─────────────
app.get('/api/transfers', authMiddleware, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM transfers WHERE from_branch_id = ? OR to_branch_id = ? ORDER BY created_at DESC', [BRANCH_ID, BRANCH_ID]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/transfers', authMiddleware, async (req, res) => {
  try {
    const id = randomUUID();
    const { to_branch_id, items } = req.body;
    for (const item of items) {
      await db.query('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.product_id]);
    }
    await db.query(
      "INSERT INTO transfers (id, from_branch_id, to_branch_id, status) VALUES (?,?,?,'pending')",
      [id, BRANCH_ID, to_branch_id]
    );
    for (const item of items) {
      await db.query('INSERT INTO transfer_items (transfer_id, product_id, quantity) VALUES (?,?,?)',
        [id, item.product_id, item.quantity]);
    }
    res.status(201).json({ id, status: 'pending' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/transfers/:id/receive', authMiddleware, async (req, res) => {
  try {
    const transfer = await db.query('SELECT * FROM transfers WHERE id = ? AND to_branch_id = ?', [req.params.id, BRANCH_ID]);
    if (!transfer.rows.length) return res.status(404).json({ error: 'Transfer not found' });
    const items = await db.query('SELECT * FROM transfer_items WHERE transfer_id = ?', [req.params.id]);
    for (const item of items.rows) {
      await db.query('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
    }
    await db.query(
      "UPDATE transfers SET status = 'received', received_at = datetime('now','localtime') WHERE id = ?",
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Sync helpers (dummy for offline mode) ──
app.get('/api/sync/pending-sales', authMiddleware, (req, res) => res.json([]));
app.get('/api/sync/pending-products', authMiddleware, (req, res) => res.json([]));
app.get('/api/sync/pending-customers', authMiddleware, (req, res) => res.json([]));
app.post('/api/sync/upsert-product', authMiddleware, (req, res) => res.json({ success: true }));
app.post('/api/sync/upsert-customer', authMiddleware, (req, res) => res.json({ success: true }));
app.post('/api/sync/update-stock', authMiddleware, (req, res) => res.json({ success: true }));
app.put('/api/sync/sale-status/:id', authMiddleware, (req, res) => res.json({ success: true }));
app.get('/api/sync/status', authMiddleware, async (req, res) => {
  const row = await db.query('SELECT * FROM sync_log LIMIT 1');
  res.json(row.rows[0]);
});
app.post('/api/sync/update-pull-timestamp', authMiddleware, (req, res) => res.json({ success: true }));

// ─── Serve Frontend ────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'renderer', 'index.html'));
});

// ─── Start Server ──────────────────────
const start = async () => {
  await db.init();
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, '0.0.0.0', () => console.log(`🔒 Secure POS running on port ${PORT} – Branch ${BRANCH_ID}`));
};
start();