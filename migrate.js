require('dotenv').config();
const initSqlJs = require('sql.js');
const fs = require('fs');
const { Pool } = require('pg');
const path = require('path');

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  // 1. Open the SQLite database
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(path.join(__dirname, 'pos.db'));
  const sqliteDb = new SQL.Database(fileBuffer);

  const pgQuery = async (text, params) => {
    const client = await pgPool.connect();
    try {
      await client.query(text, params);
    } finally {
      client.release();
    }
  };

  // 2. Copy tables one by one – using INSERT ... ON CONFLICT DO NOTHING to avoid duplicates
  const tables = [
    'users',
    'products',
    'customers',
    'customer_prices',
    'sales',
    'sale_items',
    'sync_log',
    'settings',
    'raw_materials',
    'bom',
    'work_orders',
    'work_order_materials',
    'bundles',
    'transfers',
    'transfer_items',
    'pricing_tiers'
  ];

  for (const table of tables) {
    try {
      const result = sqliteDb.exec(`SELECT * FROM ${table}`);
      if (result.length === 0 || !result[0].values.length) {
        console.log(`ℹ️  Table '${table}' is empty – skipped.`);
        continue;
      }

      const columns = result[0].columns;
      const placeholders = columns.map((_, i) => `$${i+1}`).join(',');
      const colNames = columns.map(c => `"${c}"`).join(',');

      for (const row of result[0].values) {
        try {
          await pgQuery(
            `INSERT INTO ${table} (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            row
          );
        } catch (err) {
          console.warn(`⚠️  Row in '${table}' skipped (${err.message})`);
        }
      }
      console.log(`✅ Migrated ${result[0].values.length} rows → ${table}`);
    } catch (err) {
      // Table may not exist in the old schema – that's okay
      console.log(`⚠️  Table '${table}' not found in SQLite – skipped.`);
    }
  }

  console.log('🎉 Migration complete!');
  await pgPool.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});