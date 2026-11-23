const express = require('express');
const router = express.Router();
const db = require('../database.js');
const { authMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * GET /api/pending-payments
 */
router.get('/pending-payments', authMiddleware, asyncHandler(async (req, res) => {
    try {
        // FIXED: Removed branches join, using branch_id
        const result = await db.query(`
            SELECT s.*, c.name as customer_name, CONCAT('Branch ', s.branch_id) as branch_name
            FROM sales s
            LEFT JOIN customers c ON s.customer_id = c.id
            WHERE s.status = 'pending' OR s.status = 'pending_payment'
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

/**
 * GET /api/credit-alerts
 */
router.get('/credit-alerts', authMiddleware, asyncHandler(async (req, res) => {
    try {
        // FIXED: Removed missing dueDate column, using NULL as placeholder
        const result = await db.query(`
            SELECT s.*, c.name as customer_name, c.phone as customer_phone, CONCAT('Branch ', s.branch_id) as branch_name,
                   NULL as days_until_due
            FROM sales s
            LEFT JOIN customers c ON s.customer_id = c.id
            WHERE s."paymentMethod" = 'credit' AND s.status != 'settled'
            ORDER BY s."timestamp" DESC
        `);

        const sales = result.rows;
        let overdue_count = 0;
        let due_today_count = 0;

        // Since we don't have due dates yet, we won't calculate overdue status
        sales.forEach(sale => {
            sale.alert_level = 'upcoming'; // Default for now
        });

        res.json({
            overdue_count: 0,
            due_today_count: 0,
            all: sales
        });
    } catch (error) {
        console.error('Error fetching credit alerts:', error);
        res.status(500).json({ error: 'Failed to fetch credit alerts' });
    }
}));

module.exports = router;