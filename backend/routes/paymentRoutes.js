const express = require('express');
const router = express.Router();
const db = require('../database.js');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/* GET /api/pending */
router.get('/pending', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
    
        // FIXED: Removed branches join, using branch_id
        const result = await db.query(`
            SELECT s.*, c.name AS customer_name, b.name AS branch_name
            FROM sales s
            LEFT JOIN customers c ON s.customer_id = c.id
            LEFT JOIN branches b ON s.branch_id = b.id
            WHERE s.payment_status = 'pending_payment'
            ORDER BY s."timestamp" DESC
        `);
        
        for (let sale of result.rows) {
            const items = await db.query('SELECT * FROM sale_items WHERE "saleid" = $1', [sale.id]);
            sale.items = items.rows;
        }
        
        res.json(result.rows);
}));

// put /api/payments/:id/approve
router.put('/:id/approve', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
    const saleId = req.params.id;
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        const salesRes = await client.query('SELECT * FROM sales WHERE id = $1 AND payment_status = $2 FOR UPDATE', [saleId, 'pending_payment']);
        if (!salesRes.rows.length) throw new Error('Sale not found or already processed');
        const sale = salesRes.rows[0];

        const items = await client.query('SELECT * FROM sale_items WHERE "saleId" = $1', [saleId]);
        for (let item of items.rows) {
            await client.query(
                `UPDATE branch_stock SET stock = stock - $1 WHERE branch_id = $2 AND product_id = $3`,
                [item.quantity, sale.branch_id, item.productId]
            );
        }

        await client.query(`UPDATE sales SET payment_status = 'apporved' WHERE id = $1`, [saleId]);
        await client.query('COMMIT');
        res.json({ success: true, message: 'payment approved and stock released'});
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}));

//put /api/payments/:id/reject
router.put('/:id/reject', authMiddleware, adminOnly, asyncHandler(async (req, res) => {
    await db.query(`UPDATE sales SET payment_status = 'rejected' WHERE id = $1 AND payment_status = 'pending_payment'`, [req.params.id]);
        res.json({ success: true, message: 'payment rejected'});
}));
module.exports = router;