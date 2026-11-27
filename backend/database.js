const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

// Create a high-performance connection pool from the Neon DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },   // required for Neon
  max: 50,                              // enhanced connection ceiling
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000
});

// Prevent unhandled errors on idle clients from crashing the Node.js server
pool.on('error', (err) => {
  console.warn('Unexpected idle client error on PostgreSQL pool (handled):', err.message);
});

/**
 * Execute a query and return { rows, rowCount } with automatic retry on cold start/idle disconnects.
 */
async function query(text, params, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await pool.query(text, params);
      return { rows: res.rows, rowCount: res.rowCount };
    } catch (err) {
      const isTransient = err.message.includes('timeout') ||
        err.message.includes('Connection terminated') ||
        err.message.includes('ECONNRESET') ||
        err.message.includes('connection');
      if (attempt < retries && isTransient) {
        console.warn(`DB query attempt ${attempt} failed, retrying in ${attempt * 800}ms... (${err.message})`);
        await new Promise(r => setTimeout(r, attempt * 800));
      } else {
        console.error('DB query failed:', err.message);
        throw err;
      }
    }
  }
}

/**
 * Grab a dedicated client for Database Transactions (BEGIN/COMMIT/ROLLBACK)
 * Used in /api/sales checkout to prevent race conditions.
 */
async function connect() {
  return await pool.connect();
}

/**
 * Run all migrations and seed default data.
 */
async function init() {
  // ── Branches ──────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS branches (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT,
      location TEXT,
      phone TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // authorized devices
  await query(`
    CREATE TABLE IF NOT EXISTS authorized_devices (
    id SERIAL PRIMARY KEY,
    device_label TEXT NOT NULL,
    branch_id INTEGER REFERENCES branches(id),
    token_hash TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
    )
    `);

  const branchCount = await query("SELECT COUNT(*)::int FROM branches");
  if (branchCount.rows[0].count === 0) {
    await query("INSERT INTO branches (id, name, code, location, phone) VALUES (1, 'Nairobi Branch (KPCU Godowns)', 'NRB-01', 'KPCU Godowns – along Komarocks Road- Off Kangundo Road, Nairobi', '+254700000000') ON CONFLICT (id) DO NOTHING");
    await query("INSERT INTO branches (id, name, code, location, phone) VALUES (2, 'Branch 2', 'BR-02', 'Branch 2 Location', '+254700000001') ON CONFLICT (id) DO NOTHING");
  }

  // ── Users ────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      name TEXT,
      branch_id INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  const admin = await query("SELECT id FROM users WHERE LOWER(username) = 'admin'");
  if (admin.rows.length === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await query("INSERT INTO users (id, username, password, role, name, branch_id) VALUES ($1,$2,$3,$4,$5,$6)",
      [randomUUID(), 'admin', hash, 'admin', 'Administrator', null]);
  }
  
  // ── Settings ──────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  const setting = await query("SELECT value FROM settings WHERE key = 'admin_whatsapp_number'");
  if (setting.rows.length === 0) {
    await query("INSERT INTO settings (key, value) VALUES ('admin_whatsapp_number', $1)", [process.env.DEFAULT_WHATSAPP || '+254700000000']);
  }
  const ipSetting = await query("SELECT value FROM settings WHERE key = 'ip_restriction_enabled'");
  if (ipSetting.rows.length === 0) {
    await query("INSERT INTO settings (key, value) VALUES ('ip_restriction_enabled', 'false')");
  }

  // one time enrollment codes
  await query(`
    CREATE TABLE IF NOT EXISTS device_enrollment_codes (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    branch_id INTEGER REFERENCES branches(id),
    device_label TEXT NOT NULL,
    created_by TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
    )
    `);
  // ── Products ─────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      wholesale_price REAL,
      distributor_price REAL,
      stock INTEGER DEFAULT 0,
      barcode TEXT,
      category TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ── Customers ─────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      customer_type TEXT DEFAULT 'retailer',
      kra_pin TEXT,
      security_pin TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ── Sales ─────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      idempotency_key TEXT UNIQUE, -- 👈 ADDED FOR SECURITY
      branch_id INTEGER NOT NULL,
      customer_id TEXT REFERENCES customers(id),
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      subtotal REAL,
      vat_rate REAL DEFAULT 0.16,
      vat_amount REAL DEFAULT 0,
      total REAL NOT NULL,
      paymentMethod TEXT DEFAULT 'mobile_money',
      payment_reference TEXT,
      credit_terms TEXT,
      due_date DATE,
      payment_status TEXT DEFAULT 'pending_payment',
      status TEXT DEFAULT 'completed',
      created_by TEXT
    )
  `);
  // Fallback migration for existing tables
  try { await query("ALTER TABLE sales ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE"); } catch (_) {}

  // ── Sale Items ────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id SERIAL PRIMARY KEY,
      saleId TEXT NOT NULL REFERENCES sales(id),
      productId TEXT NOT NULL,
      productName TEXT,
      quantity REAL NOT NULL,
      price REAL NOT NULL
    )
  `);

  // ── Branch Stock ──────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS branch_stock (
      branch_id INTEGER NOT NULL,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      stock REAL DEFAULT 0,
      PRIMARY KEY (branch_id, product_id)
    )
  `);

  //transfers
  await query(`
    CREATE TABLE IF NOT EXISTS transfers (
      id TEXT PRIMARY KEY,
      from_branch_id INTEGER NOT NULL,
      to_branch_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      received_by TEXT,
      received_at TIMESTAMPTZ
      )
    `);

    //transfer items
    await query(`
      CREATE TABLE IF NOT EXISTS transfer_items (
        id SERIAL PRIMARY KEY,
        transfer_id TEXT NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL,
        quantity REAL NOT NULL
        )
     `);


  // ── Database Performance Indexes ──────
  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON sales(timestamp)",
    "CREATE INDEX IF NOT EXISTS idx_sales_branch_id ON sales(branch_id)",
    "CREATE INDEX IF NOT EXISTS idx_sale_items_saleid ON sale_items(saleId)",
    "CREATE INDEX IF NOT EXISTS idx_branch_stock_lookup ON branch_stock(branch_id, product_id)",
    "CREATE INDEX IF NOT EXISTS idx_sales_idempotency ON sales(idempotency_key)" // 👈 Index for fast idempotency checks
  ];
  for (const idx of indexes) {
    try { await query(idx); } catch (_) {}
  }

  console.log('Database tables & performance indexes verified.');
}

// Graceful pool shutdown on termination
process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});

// Export the functions so routes can use them
module.exports = { query, connect, init }; // 👈 EXPORTED CONNECT