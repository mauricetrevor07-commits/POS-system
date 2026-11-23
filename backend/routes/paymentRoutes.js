const express = require('express');
const router = express.Router();
const db = require('../database.js');
const { authMiddleware } = require('../middleware/auth.js');
const { asyncHandler} = require('../middleware/errorHandler.js');

router.get('/pending-payments', authMiddleware, asyncHandler(async (req, res) =>
{
   try {
    const result = await db.query(`
        SELECT s.*, c.name as customer_name. b.name as branch_name
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN branches b ON s.branch_id = b.id
        WHERE s.status = 'pending' OR s.payment_status = 'pending_payment'
        ORDER BY s."timestamp" DESC
        `);

        for (let sale of result.rows) {
            const items = await db.query('SELECT * FROM sale_items WHERE "saleId" = $1', [sale.id]);
            sale.items = items.rows;
        }

        res.json(result.rows);
   } catch (error) {
    console.error('Error fetching pending payments:', error);
    res.status(500).json({ error: 'Failed to fetch pending payments' });
   }
}));

router.get('/credit-alerts', authMiddleware, asyncHandler(async (req, res) => {
    try {
        const result = await db.query(`
            SELECT s.*, c.name as customer_name, c.phone as customer_phone, b.name as branch_name,
            (s."due_date"::date - CURRENT_DATE)) as days_until_due
            FROM sales s
            LEFT JOIN customers c ON s.customer_id = c.id
            LEFT JOIN branches b ON s.branch_id = b.id
            WHERE s."paymentMethod" = 'crredit' AND s.status != 'settled'
            ORDER BY s."due_date" ASC
             `);

             const sales= result.rows;
             let overdue_count = 0;
             let due_today_count = 0;

             sales.forEach(sale => {
                const days = parseFloat(sale.days_until_due);
                if (days < 0) {
                    overdue_count++;
                    sale.alert_level = 'overdue';
                } else if (days === 0) {
                    due_today_count++;
                    sale.alert_level = 'due_today';
                } else if (days <=3) {
                    sale.alert_level = 'due_soon';
                }
             });

             res.json({
                overdue_count,
                due_today_count,
                all: sales
             });
    } catch (error) {
        console.error('Error fetching credit alerts:', error );
        res.status(500).json({ error: 'Failed to fetch credit alerts' });
    }
}));

module.exports = router;