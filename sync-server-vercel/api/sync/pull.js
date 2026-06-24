const { neon } = require('@neondatabase/serverless');

const AUTH_TOKEN = process.env.AUTH_TOKEN;

module.exports = async (req, res) => {
  // Auth
  const token = req.headers['x-auth-token'];
  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    const since = req.query.since || '1970-01-01T00:00:00.000Z';
    const products = await sql`SELECT * FROM products WHERE updated_at > ${since}`;
    const customers = await sql`SELECT * FROM customers WHERE updated_at > ${since}`;
    const stockUpdates = await sql`SELECT id AS product_id, stock FROM products WHERE updated_at > ${since}`;

    res.json({
      server_timestamp: new Date().toISOString(),
      products,
      customers,
      stock_updates: stockUpdates,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};