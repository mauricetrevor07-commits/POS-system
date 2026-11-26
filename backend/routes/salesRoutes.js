const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const db = require('../database.js');
const { authMiddleware } = require('../middleware/auth');

// POST /api/sales (Secure Checkout)
router.post('/', authMiddleware, async (req, res) => {
  const { 
    items, paymentMethod, customer_id, payment_reference, 
    vat_rate, credit_terms, due_date, branch_id, idempotency_key 
  } = req.body;

  if (!items || !items.length) return res.status(400).json({ error: 'Cart is empty' });
  if (!idempotency_key) return res.status(400).json({ error: 'Security Error: Idempotency key missing' });
  if (paymentMethod !== 'cash' && (!payment_reference || payment_reference.trim() === '')) {
    return res.status(400).json({ error: 'Transaction reference is required for non-cash payments' });
  }

  const client = await db.connect(); 
  
  try {
    await client.query('BEGIN'); // START TRANSACTION

    // 1. Idempotency Check
    const checkExisting = await client.query('SELECT id FROM sales WHERE idempotency_key = $1', [idempotency_key]);
    if (checkExisting.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(200).json({ success: true, message: 'Sale already processed', saleId: checkExisting.rows[0].id });
    }

    const saleBranchId = req.user.role === 'staff' ? (req.user.branch_id || 1) : (parseInt(branch_id) || req.user.branch_id || 1);
    const finalCustomerId = (customer_id && customer_id.trim() !== '') ? customer_id : null;
    const finalVatRate = parseFloat(vat_rate) || 0.16;
    const isCash = paymentMethod === 'cash';
    const paymentStatus = isCash ? 'approved' : 'pending_payment';

    let subtotal = 0;
    const evaluatedItems = [];

    // 2. Loop Items, Lock Rows, Calculate Prices
    for (const item of items) {
      // Step A: Fetch and Lock the Product (No aliases to avoid errors)
      const prodResult = await client.query(
        `SELECT id, name, price FROM products WHERE id = $1 FOR UPDATE`, 
        [item.productId]
      );
      
      if (!prodResult.rows.length) throw new Error(`Product not found`);
      const product = prodResult.rows[0];

      // Step B: Fetch and Lock the Branch Stock
      let stockResult = await client.query(
        `SELECT stock FROM branch_stock WHERE product_id = $1 AND branch_id = $2 FOR UPDATE`, 
        [item.productId, saleBranchId]
      );
      
      let currentStock = 0;
      if (stockResult.rows.length > 0) {
        currentStock = parseFloat(stockResult.rows[0].stock);
      } else {
        // Create a 0 stock record if it doesn't exist for this branch
        await client.query(
          `INSERT INTO branch_stock (branch_id, product_id, stock) VALUES ($1, $2, 0) ON CONFLICT DO NOTHING`,
          [saleBranchId, item.productId]
        );
      }

      if (currentStock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${currentStock}, Requested: ${item.quantity}`);
      }

      const price = parseFloat(product.price); 
      subtotal += price * item.quantity;
      
      evaluatedItems.push({ 
        productId: item.productId, 
        productName: product.name, 
        quantity: item.quantity, 
        price 
      });
    }

    // 3. Calculate Final Totals
    const vatAmount = finalVatRate > 0 ? Math.round(subtotal * finalVatRate * 100) / 100 : 0;
    const total = Math.round((subtotal + vatAmount) * 100) / 100;
    const saleId = randomUUID();

    // 4. Insert Sale
    await client.query(
      `INSERT INTO sales (id, idempotency_key, branch_id, customer_id, subtotal, vat_rate, vat_amount, total, paymentMethod, payment_reference, credit_terms, due_date, payment_status, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'completed',$14)`,
      [saleId, idempotency_key, saleBranchId, finalCustomerId, subtotal, finalVatRate, vatAmount, total, paymentMethod, payment_reference, credit_terms || null, due_date || null, paymentStatus, req.user.username]
    );

    // 5. Insert Sale Items & Deduct Stock (Only if Cash)
    for (const item of evaluatedItems) {
      // FIXED: Column names are lowercase, no quotes.
      await client.query(
        `INSERT INTO sale_items (saleid, productid, productname, quantity, price) 
         VALUES ($1,$2,$3,$4,$5)`,
        [saleId, item.productId, item.productName, item.quantity, item.price]
      );
      
      // If it's a cash sale, deduct the stock immediately
      if (isCash) {
        await client.query(
          `UPDATE branch_stock SET stock = stock - $1 WHERE branch_id = $2 AND product_id = $3`,
          [item.quantity, saleBranchId, item.productId]
        );
      }
    }

    await client.query('COMMIT'); 
    res.status(201).json({ id: saleId, total, payment_status: paymentStatus, message: isCash ? 'Cash sale completed' : 'Sale pending approval' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("🔥 SALE ERROR:", err.message); 
    res.status(500).json({ error: err.message }); 
  } finally {
    client.release();
  }
});

// GET /api/sales (Sales History)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const userBranch = req.user.branch_id || 1;

    let sql = `
      SELECT s.*, c.name AS customer_name, c.kra_pin AS customer_kra_pin
      FROM sales s 
      LEFT JOIN customers c ON s.customer_id = c.id
    `;
    const params = [];
    
    if (!isAdmin) {
      sql += ` WHERE s.branch_id = $1`;
      params.push(userBranch);
    }
    
    sql += " ORDER BY s.timestamp DESC";
    
    const sales = await db.query(sql, params);
    
    for (let sale of sales.rows) {
      // FIXED: use lowercase saleid
      const items = await db.query('SELECT * FROM sale_items WHERE saleid = $1', [sale.id]);
      sale.items = items.rows;
    }
    
    res.json(sales.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;