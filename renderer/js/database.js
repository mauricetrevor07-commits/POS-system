const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

class DatabaseManager {
  constructor() {
    this.db = null;
    this.dbPath = path.join(__dirname, 'pos.db');
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
    this.save();

    if (sql.trim().toUpperCase().startsWith('SELECT')) return { rows };
    else if (sql.trim().toUpperCase().startsWith('INSERT')) {
      const lastID = this.db.exec("SELECT last_insert_rowid()")[0]?.values[0][0];
      return { lastID, changes: this.db.getRowsModified() };
    } else return { changes: this.db.getRowsModified() };
  }

  save() {
    const data = this.db.export();
    fs.writeFileSync(this.dbPath, Buffer.from(data));
  }

  migrate() {
    // Products – now UUID, stock column, no branch_stock
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

    // Customers – UUID
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

    // Customer prices – UUID
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

    // Sales – now with sync status
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        branch_id INTEGER NOT NULL,
        customer_id TEXT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        total REAL NOT NULL,
        paymentMethod TEXT DEFAULT 'cash',
        status TEXT DEFAULT 'pending_sync',
        sync_error TEXT,
        FOREIGN KEY (customer_id) REFERENCES customers(id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        saleId TEXT NOT NULL,
        productId TEXT NOT NULL,
        productName TEXT,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY (saleId) REFERENCES sales(id)
      )
    `);

    // Sync log (track last pull/push timestamps)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        last_pull_timestamp TEXT,
        last_push_timestamp TEXT
      )
    `);
    const count = this.db.exec("SELECT COUNT(*) FROM sync_log");
    if (count[0].values[0][0] === 0) {
      this.db.run("INSERT INTO sync_log (last_pull_timestamp, last_push_timestamp) VALUES (?,?)", [new Date(0).toISOString(), new Date(0).toISOString()]);
    }

    this.save();
  }
}

module.exports = new DatabaseManager();