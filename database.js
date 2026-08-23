const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

// Create a connection pool from the Neon DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },   // required for Neon
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// Prevent unhandled errors on idle clients from crashing the Node.js server
pool.on('error', (err) => {
  console.warn('Unexpected idle client error on PostgreSQL pool (handled):', err.message);
});

/**
 * Execute a query and return { rows, rowCount }.
 */
async function query(text, params) {
  try {
    const res = await pool.query(text, params);
    return { rows: res.rows, rowCount: res.rowCount };
  } catch (err) {
    console.error('DB query failed:', err.message);
    throw err;
  }
}

/**
 * Run all migrations and seed default data.
 */
async function init() {
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

  // Seed default admin, staff, and cashier if they don't exist
  const admin = await query("SELECT id FROM users WHERE LOWER(username) = 'admin'");
  if (admin.rows.length === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await query("INSERT INTO users (id, username, password, role, name) VALUES ($1,$2,$3,$4,$5)",
      [randomUUID(), 'admin', hash, 'admin', 'Administrator']);
  }
  
  const staff = await query("SELECT id FROM users WHERE LOWER(username) = 'staff'");
  if (staff.rows.length === 0) {
    const hash = bcrypt.hashSync('staff123', 10);
    await query("INSERT INTO users (id, username, password, role, name) VALUES ($1,$2,$3,$4,$5)",
      [randomUUID(), 'staff', hash, 'staff', 'Staff User']);
  } else {
    // Ensure staff has a known password
    const hash = bcrypt.hashSync('staff123', 10);
    await query("UPDATE users SET password = $1, role = 'staff' WHERE LOWER(username) = 'staff'", [hash]);
  }

  const cashier = await query("SELECT id FROM users WHERE LOWER(username) = 'cashier'");
  if (cashier.rows.length === 0) {
    const hash = bcrypt.hashSync('cashier123', 10);
    await query("INSERT INTO users (id, username, password, role, name) VALUES ($1,$2,$3,$4,$5)",
      [randomUUID(), 'cashier', hash, 'staff', 'Cashier User']);
  }

  // If Trevor user exists, ensure password is set to staff123
  try {
    const trevor = await query("SELECT id FROM users WHERE LOWER(username) = 'trevor'");
    if (trevor.rows.length > 0) {
      const hash = bcrypt.hashSync('staff123', 10);
      await query("UPDATE users SET password = $1, role = 'staff' WHERE LOWER(username) = 'trevor'", [hash]);
    }
  } catch (_) {}

  // ── Settings ──────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  const setting = await query("SELECT value FROM settings WHERE key = 'admin_whatsapp_number'");
  if (setting.rows.length === 0) {
    await query("INSERT INTO settings (key, value) VALUES ('admin_whatsapp_number', $1)",
      [process.env.DEFAULT_WHATSAPP || '+254700000000']);
  }

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
  try { await query("ALTER TABLE products ADD COLUMN IF NOT EXISTS wholesale_price REAL"); } catch (_) {}
  try { await query("ALTER TABLE products ADD COLUMN IF NOT EXISTS distributor_price REAL"); } catch (_) {}

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
  try { await query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS kra_pin TEXT"); } catch (_) {}
  try { await query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS security_pin TEXT"); } catch (_) {}
  try { await query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_type TEXT DEFAULT 'retailer'"); } catch (_) {}

  // ── Customer Prices ───────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS customer_prices (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      product_id TEXT NOT NULL REFERENCES products(id),
      custom_price REAL NOT NULL,
      UNIQUE(customer_id, product_id)
    )
  `);

  // ── Sales ─────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
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
      sync_error TEXT,
      etims_invoice TEXT,
      etims_qr TEXT,
      created_by TEXT
    )
  `);
  try { await query("ALTER TABLE sales ADD COLUMN IF NOT EXISTS subtotal REAL"); } catch (_) {}
  try { await query("ALTER TABLE sales ADD COLUMN IF NOT EXISTS vat_rate REAL DEFAULT 0.16"); } catch (_) {}
  try { await query("ALTER TABLE sales ADD COLUMN IF NOT EXISTS vat_amount REAL DEFAULT 0"); } catch (_) {}
  try { await query("ALTER TABLE sales ADD COLUMN IF NOT EXISTS credit_terms TEXT"); } catch (_) {}
  try { await query("ALTER TABLE sales ADD COLUMN IF NOT EXISTS due_date DATE"); } catch (_) {}

  // ── Category Tier Pricing Rules ─────────
  await query(`
    CREATE TABLE IF NOT EXISTS category_tier_pricing (
      category TEXT PRIMARY KEY,
      wholesale_discount_pct REAL DEFAULT 10,
      distributor_discount_pct REAL DEFAULT 15,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Seed default category tier rules if not exists
  const defaultCats = [
    { cat: 'HDPE Pipes', ws: 10, dist: 20 },
    { cat: 'Heavy Duty Sacks', ws: 8, dist: 15 },
    { cat: 'Fittings & Accessories', ws: 12, dist: 22 },
    { cat: 'General', ws: 5, dist: 10 }
  ];
  for (const c of defaultCats) {
    try {
      await query(
        `INSERT INTO category_tier_pricing (category, wholesale_discount_pct, distributor_discount_pct)
         VALUES ($1, $2, $3) ON CONFLICT (category) DO NOTHING`,
        [c.cat, c.ws, c.dist]
      );
    } catch (_) {}
  }

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

  // ── Sync Log ──────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS sync_log (
      id SERIAL PRIMARY KEY,
      last_pull_timestamp TIMESTAMPTZ,
      last_push_timestamp TIMESTAMPTZ
    )
  `);
  const cnt = await query("SELECT COUNT(*)::int FROM sync_log");
  if (cnt.rows[0].count === 0) {
    await query("INSERT INTO sync_log (last_pull_timestamp, last_push_timestamp) VALUES ($1,$2)",
      [new Date(0).toISOString(), new Date(0).toISOString()]);
  }

  // ── Manufacturing ERP tables (raw materials, BOM, work orders, bundles, transfers, pricing tiers) ──
  await query(`
    CREATE TABLE IF NOT EXISTS raw_materials (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unit TEXT DEFAULT 'kg',
      stock REAL DEFAULT 0,
      min_stock REAL DEFAULT 0,
      cost_per_unit REAL DEFAULT 0,
      supplier TEXT
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS bom (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id),
      raw_material_id TEXT NOT NULL REFERENCES raw_materials(id),
      quantity_required REAL NOT NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS work_orders (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id),
      quantity_produced REAL NOT NULL,
      lot_number TEXT,
      status TEXT DEFAULT 'draft',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      branch_id INTEGER NOT NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS work_order_materials (
      id SERIAL PRIMARY KEY,
      work_order_id TEXT NOT NULL REFERENCES work_orders(id),
      raw_material_id TEXT NOT NULL REFERENCES raw_materials(id),
      quantity_used REAL NOT NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS bundles (
      id TEXT PRIMARY KEY,
      bundle_product_id TEXT NOT NULL REFERENCES products(id),
      component_product_id TEXT NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS transfers (
      id TEXT PRIMARY KEY,
      from_branch_id INTEGER NOT NULL,
      to_branch_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      received_at TIMESTAMPTZ
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS transfer_items (
      id SERIAL PRIMARY KEY,
      transfer_id TEXT NOT NULL REFERENCES transfers(id),
      product_id TEXT NOT NULL REFERENCES products(id),
      quantity REAL NOT NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS pricing_tiers (
      id TEXT PRIMARY KEY,
      customer_id TEXT REFERENCES customers(id),
      min_quantity REAL NOT NULL,
      discount_percent REAL NOT NULL
    )
  `);

  console.log('Database tables created / verified.');
}

// Graceful pool shutdown on termination
process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});

module.exports = { query, init };