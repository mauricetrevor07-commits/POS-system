const { neon } = require('@neondatabase/serverless');
const AUTH_TOKEN = process.env.AUTH_TOKEN;

module.exports = async (req, res) => {
  const token = req.headers['x-auth-token'];
  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    const { branch_id, sales, products, customers } = req.body;
    const results = { sales: [], id_mappings: [] };

    // Upsert products
    for (const p of products || []) {
      await sql`
        INSERT INTO products (id, name, price, stock, barcode, category, updated_at)
        VALUES (${p.id}, ${p.name}, ${p.price}, ${p.stock}, ${p.barcode}, ${p.category}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          price = EXCLUDED.price,
          stock = EXCLUDED.stock,
          barcode = EXCLUDED.barcode,
          category = EXCLUDED.category,
          updated_at = NOW()
      `;
    }

    // Upsert customers
    for (const c of customers || []) {
      await sql`
        INSERT INTO customers (id, name, contact_person, phone, email, address, updated_at)
        VALUES (${c.id}, ${c.name}, ${c.contact_person}, ${c.phone}, ${c.email}, ${c.address}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          contact_person = EXCLUDED.contact_person,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          address = EXCLUDED.address,
          updated_at = NOW()
      `;
    }

    // Process sales
    for (const sale of sales || []) {
      const items = sale.items || [];
      let insufficient = false;

      for (const item of items) {
        const [prod] = await sql`SELECT stock FROM products WHERE id = ${item.productId}`;
        if (!prod || prod.stock < item.quantity) {
          insufficient = true;
          results.sales.push({ id: sale.id, status: 'rejected', error: `Insufficient stock for ${item.productName}` });
          break;
        }
      }
      if (insufficient) continue;

      // Deduct stock
      for (const item of items) {
        await sql`UPDATE products SET stock = stock - ${item.quantity}, updated_at = NOW() WHERE id = ${item.productId}`;
      }

      // Insert sale
      await sql`
        INSERT INTO sales (id, branch_id, customer_id, timestamp, total, paymentMethod, status)
        VALUES (${sale.id}, ${branch_id}, ${sale.customer_id}, ${sale.timestamp}, ${sale.total}, ${sale.paymentMethod}, 'completed')
      `;
      for (const item of items) {
        await sql`
          INSERT INTO sale_items (saleId, productId, productName, quantity, price)
          VALUES (${sale.id}, ${item.productId}, ${item.productName}, ${item.quantity}, ${item.price})
        `;
      }
      results.sales.push({ id: sale.id, status: 'synced' });
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};