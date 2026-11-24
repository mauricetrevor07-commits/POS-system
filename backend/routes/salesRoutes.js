const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const db = require('../database.js');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const {asyncHandler } = require('../middleware/errorHandler');

router.post('/', authMiddleware, asyncHandler(async (req, res) => {
    const {
        items,
        paymentMethod,
        customer_id,
        payment_reference,
        vat_rate, 
        credit_terms,
        due_date,
        branch_id,
        idempotency_key,
    } = req.body;

    if (!items || !items.length) return res.status(400).json({ error: 'Cart is empty '});
    if (!idempotency_key) return res.status(400).json({ error: 'idemptoncy key required' });

    const client = await db.connect();
    try{
        await client.query('BEGIN');

        const checkExisting = await client.query('SELECT id FROM sales WHERE idempotency_key = $1', [idempotency_key]);
            if (checkExisting.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(200).json({success: true, message: 'sale already processed', saleId: checkExisting.rows[0].id });
        }

        const saleBranchId = req.user.role === 'staff' ? (req.user.branch_id || 1) : (parseInt(branch_id) || req.user.branch_id || 1);

        let subtotal = 0;
        const evaluatedItems =[];

        for (const item of items) {
            const prod = await client.query(
                `SELECT p.*, COALESCE(bs.stock, 0)::real AS stock
                FROM products p
                LEFT JOIN branch_stock bs ON p.id = bs.product_id AND bs.branch_id = $1
                WHERE p.id = $2 FOR UPDATE`,
                [saleBranchId, item.productId]
            );

            if (!prod.rows.length) throw new Error(`Product not found`);
            const product = prod.rows[0];

            if (product.stock < item.quantity) {
                throw new Error(`Insufficient stock for ${product.name} (Available: ${product.stock})`);
            }
            const price = product.price;
            subtotal += price * item.quantity;
            evaluatedItems.push({ productId: item.productId, productName: product.name, quantity: item.quantity, price });
        }
        const vatRate = vat_rate !== undefined ? parseFloat(vat_rate) : 0.16;
        const vatAmount = vatRate > 0 ? Math.round(subtotal * vatRate * 100)/ 100 : 0;
        const total = Math.round((subtotal + vatAmount) * 100) / 100;
        const saleId = randomUUID();

        await client.query(
            `INSERT INTO sales (id, idempotency_key, branch_id, customer_id, subtotal, vat_rate, vat_amount, total, paymentMethod, payment_reference, status, created_by)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'completed',$11)`,
            [saleId, idempotency_key, saleBranchId, customer_id || null, subtotal, vatRate, vatAmount, total, paymentMethod, payment_reference || null, req.user.username]
        );

        for (const item of evaluatedItems) {
            await client.query(
                `INSERT INTO sale_items (saleId, productId, productName, quantity, price) VALUES ($1,$2,$3,$4,$5)`,
                [saleId, item.productId, item.productName, item.quantity, item.price]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ id: saleId, total, message: 'Sale successful' });
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}));

router.get('/', authMiddleware, asyncHandler(async (req, res) => {
    const isAdmin = req.user.role === 'admin';
    const userBranch = req.user.branch_id || 1;

    let sql = `
    select s.*, c.name AS customer_name, c.kra_pin AS customer_kra_pin
    FROM sales s
    LEFT  JOIN customers c ON s.customer_id = c.id
    `;
    const params = [];

    if (!isAdmin) {
        sql += `where s.branch_id = $1`;
        params.push(userBranch);
    }

    sql += " ORDER BY s.timestamp DESC";
    const sales = await db.query(sql, params);

    for (let sale of sales.rows) {
        const items = await db.query('SELECT * FROM sale_items WHERE "saleid" = $1', [sale.id]);
        sale.items = items.rows;
    }
    res.json(sales.rows);
}));

module.exports = router;