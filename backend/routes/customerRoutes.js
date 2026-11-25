const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const db = require('../database.js');
const { authMiddleware, adminOnly } = require('../middleware/auth.js');
const { asyncHandler } = require('../middleware/errorHandler.js');

router.get('/', authMiddleware, asyncHandler(async (req, res) => {
    const result = await db.query('SELECT * FROM customers ORDER BY name');
    res.json(result.rows);
}));

router.post('/', authMiddleware, asyncHandler(async (req, res) => {
    const { name, contact_person, phone, email, address, customer_type, kra_pin }
    = req.body;
    const id = randomUUID();
    await db.query(
        `INSERT INTO customers (id, name, contact_person, phone, email, address, customer_type, kra_pin )
        VALUES ($1,$2.$3,$4,$5,$6,$7,$8)`,
        [id, name, contact_person || null, phone || null, email || null, address || null, customer_type || 'retailer', kra_pin || null]
    );
    res.status(201).json({ id, ...req.body });
}));

router.put('/:id', authMiddleware, asyncHandler(async (req, res) => {
    const { name, contact_person, phone, email, address, customer_type,kra_pin } = req.body;
    await db.query(
        `UPDATE customers SET name=$1, contact_person=$2, phone=$3, email=$4, address=$5, customer_type=$6, kra_pin=$7, updated_at=NOW() WHERE id=$8`,
        [name, contact_person || null, phone || null, email || null, address || null, customer_type, kra_pin || null, req.params.id]
    );
    res.json({success: true });
}));

router.delete('/:id', authMiddleware, adminOnly, asyncHandler(async (req,res)=> {
    await db.query('DELETE FROM customer_prices WHERE customer_id = $1', [req.params.id]);
    await db.query('UPDATE sales SET customer_id = NULL WHERE customer_id = $1', [req.params.id]);
    await db.query('DELETE FROM customers WHERE id = $1', [req.params.id]);
    res.json({ success: true });
}));

router.get('/customer-prices/:customerId', authMiddleware, asyncHandler(async (req, res) => {
    const result = await db.query('SELECT * FROM customer_prices WHERE customer_id = $1', [req.params.customerId]);
    res.json(result.rows);
}));

router.post('/customer-prices', authMiddleware, asyncHandler(async (req, res)=> {
    const { customer_id, product_id, custom_price } = req.body;
    await db.query(
        `INSERT INTO customer_prices (id, customer_id, product_id, custom_price)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (customer_id, product_id) DO UPDATE SET custom_price = $4`,
        [randomUUID(), customer_id, product_id, custom_price]
    );
    res.json({ success:true });
}));
module.exports = router;