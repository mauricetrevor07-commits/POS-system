const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

class DatabaseManager {
  constructor() {
    this.db = null;
    this.dbPath = path.join(__dirname, 'pos.db');
    this.saveTimeout = null;

    // Register exit handlers to flush database changes
    process.on('exit', () => this.flush());
    process.on('SIGINT', () => { this.flush(); process.exit(); });
    process.on('SIGTERM', () => { this.flush(); process.exit(); });
  }

  async init() {
    const SQL = await initSqlJs();
    if (fs.existsSync(this.dbPath)) {
      const fileBuffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }
    this.db.run('PRAGMA journal_mode=WAL');
    this.db.run('PRAGMA busy_timeout=5000');
    this.migrate();
  }

  query(sql, params = []) {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();

    const isWrite = !/^\s*(SELECT|PRAGMA)/i.test(sql);
    if (isWrite) {
      this.save();
    }

    if (!isWrite) return { rows };
    else if (sql.trim().toUpperCase().startsWith('INSERT')) {
      const lastID = this.db.exec("SELECT last_insert_rowid()")[0]?.values[0][0];
      return { lastID, changes: this.db.getRowsModified() };
    } else return { changes: this.db.getRowsModified() };
  }

  save() {
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.flush();
    }, 50);
  }

  flush() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (this.db) {
      const data = this.db.export();
      fs.writeFileSync(this.dbPath, Buffer.from(data));
    }
  }

  migrate() {
    // ─── Users table & seeding ───────────
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now','localtime'))
      )
    `);

    try {
      const userCountResult = this.db.exec("SELECT COUNT(*) FROM users");
      const userCount = userCountResult[0]?.values[0][0];
      if (userCount === 0) {
        const bcrypt = require('bcryptjs');
        const adminHash = bcrypt.hashSync('admin123', 10);
        const cashierHash = bcrypt.hashSync('cashier123', 10);
        this.db.run("INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)",
          ['user-admin-uuid', 'admin', adminHash, 'admin']);
        this.db.run("INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)",
          ['user-branch1-uuid', 'branch1', cashierHash, 'cashier']);
        this.db.run("INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)",
          ['user-branch2-uuid', 'branch2', cashierHash, 'cashier']);
      }
    } catch (err) {
      console.error('Failed to seed default users:', err);
    }

    try { this.db.run("ALTER TABLE users ADD COLUMN name TEXT"); } catch (_) {}
    try { this.db.run("ALTER TABLE users ADD COLUMN branch_id INTEGER"); } catch (_) {}

    // ─── Original tables ─────────────────
    this.db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        stock INTEGER DEFAULT 0,
        barcode TEXT,
        category TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        contact_person TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS customer_prices (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        custom_price REAL NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(id),
        FOREIGN KEY (product_id) REFERENCES products(id),
        UNIQUE(customer_id, product_id)
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        branch_id INTEGER NOT NULL,
        customer_id TEXT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        total REAL NOT NULL,
        paymentMethod TEXT DEFAULT 'cash',
        status TEXT DEFAULT 'completed',
        sync_error TEXT,
        etims_invoice TEXT,
        etims_qr TEXT,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      )
    `);

    // Migration to add missing columns to sales table if they do not exist
    try { this.db.run("ALTER TABLE sales ADD COLUMN payment_reference TEXT"); } catch (_) {}
    try { this.db.run("ALTER TABLE sales ADD COLUMN payment_status TEXT"); } catch (_) {}
    try { this.db.run("ALTER TABLE sales ADD COLUMN created_by TEXT"); } catch (_) {}
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        saleId TEXT NOT NULL,
        productId TEXT NOT NULL,
        productName TEXT,
        quantity REAL NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY (saleId) REFERENCES sales(id)
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        last_pull_timestamp TEXT,
        last_push_timestamp TEXT
      )
    `);
    const count = this.db.exec("SELECT COUNT(*) FROM sync_log");
    if (count[0].values[0][0] === 0) {
      this.db.run("INSERT INTO sync_log (last_pull_timestamp, last_push_timestamp) VALUES (?,?)",
        [new Date(0).toISOString(), new Date(0).toISOString()]);
    }

    // ─── Manufacturing ERP tables ───────
    this.db.run(`
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

    this.db.run(`
      CREATE TABLE IF NOT EXISTS bom (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        raw_material_id TEXT NOT NULL,
        quantity_required REAL NOT NULL,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS work_orders (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        quantity_produced REAL NOT NULL,
        lot_number TEXT,
        status TEXT DEFAULT 'draft',
        created_at TEXT DEFAULT (datetime('now','localtime')),
        completed_at TEXT,
        branch_id INTEGER NOT NULL,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS work_order_materials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        work_order_id TEXT NOT NULL,
        raw_material_id TEXT NOT NULL,
        quantity_used REAL NOT NULL,
        FOREIGN KEY (work_order_id) REFERENCES work_orders(id),
        FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS bundles (
        id TEXT PRIMARY KEY,
        bundle_product_id TEXT NOT NULL,
        component_product_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        FOREIGN KEY (bundle_product_id) REFERENCES products(id),
        FOREIGN KEY (component_product_id) REFERENCES products(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS transfers (
        id TEXT PRIMARY KEY,
        from_branch_id INTEGER NOT NULL,
        to_branch_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now','localtime')),
        received_at TEXT
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS transfer_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transfer_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        quantity REAL NOT NULL,
        FOREIGN KEY (transfer_id) REFERENCES transfers(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS pricing_tiers (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        min_quantity REAL NOT NULL,
        discount_percent REAL NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      )
    `);
    // ─── Settings table ──────────────────
    this.db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    try {
      const settingsCount = this.db.exec("SELECT COUNT(*) FROM settings WHERE key = 'admin_whatsapp_number'");
      if (settingsCount[0]?.values[0][0] === 0) {
        const defaultNumber = process.env.ADMIN_WHATSAPP_NUMBER || '+254700000000';
        this.db.run("INSERT INTO settings (key, value) VALUES (?, ?)", ['admin_whatsapp_number', defaultNumber]);
      }
    } catch (err) {
      console.error('Failed to seed default settings:', err);
    }

    this.save();
  }
}

module.exports = new DatabaseManager();