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

    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return { rows };
    } else if (sql.trim().toUpperCase().startsWith('INSERT')) {
      const lastID = this.db.exec("SELECT last_insert_rowid()")[0]?.values[0][0];
      return { lastID, changes: this.db.getRowsModified() };
    } else {
      return { changes: this.db.getRowsModified() };
    }
  }

  save() {
    const data = this.db.export();
    fs.writeFileSync(this.dbPath, Buffer.from(data));
  }

  migrate() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        stock INTEGER DEFAULT 0,
        barcode TEXT,
        category TEXT
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        total REAL NOT NULL,
        paymentMethod TEXT DEFAULT 'cash',
        status TEXT DEFAULT 'completed'
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        saleId INTEGER NOT NULL,
        productId INTEGER NOT NULL,
        productName TEXT,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY (saleId) REFERENCES sales(id)
      )
    `);
    this.save();
  }
}

module.exports = new DatabaseManager();