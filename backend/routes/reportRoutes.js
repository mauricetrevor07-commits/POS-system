const express = require('express');
const router = express.Router();
const db = require('../database.js');
const { authMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

router.get('/sales-summary', authMiddleware, asyncHandler(async (req, res) => {
    const { from, to, branch_id } = req.query;

    let salesWhere = `s.status != 'pending'`; 
    let itemWhere = `s.status != 'pending'`;
    const salesParams = [];
    const itemParams = [];

    if (from) {
        salesWhere += ` AND s."timestamp" >= $${salesParams.length + 1}`;
        itemWhere += ` AND s."timestamp" >= $${itemParams.length + 1}`;
        salesParams.push(from);
        itemParams.push(from);
    }
    if (to) {
        salesWhere += ` AND s."timestamp" <= $${salesParams.length + 1}`;
        itemWhere += ` AND s."timestamp" <= $${itemParams.length + 1}`;
        salesParams.push(`${to} 23:59:59`);
        itemParams.push(`${to} 23:59:59`);
    }
    if (branch_id) {
        salesWhere += ` AND s.branch_id = $${salesParams.length + 1}`;
        itemWhere += ` AND s.branch_id = $${itemParams.length + 1}`;
        salesParams.push(parseInt(branch_id));
        itemParams.push(parseInt(branch_id));
    }

    try {
        // 1. KPI Query
        const kpiQuery = `
            SELECT 
                COALESCE(COUNT(s.id), 0) as total_sales,
                COALESCE(SUM(s.total), 0) as total_amount
            FROM sales s
            WHERE ${salesWhere}
        `;
        const kpiResult = await db.query(kpiQuery, salesParams);
        const kpi = kpiResult.rows[0];

        // 2. Pipes/Sacks Query (FIXED: snake_case)
        const categoryQuery = `
            SELECT 
                COALESCE(SUM(CASE WHEN LOWER(p.category) LIKE '%pipe%' THEN si.quantity ELSE 0 END), 0) as total_pipes_sold,
                COALESCE(SUM(CASE WHEN LOWER(p.category) LIKE '%sack%' THEN si.quantity ELSE 0 END), 0) as total_sacks_sold
            FROM sale_items si
            JOIN sales s ON si.saleid = s.id
            LEFT JOIN products p ON si.productid = p.id
            WHERE ${itemWhere}
        `;
        const categoryResult = await db.query(categoryQuery, itemParams);
        const categories = categoryResult.rows[0];

        // 3. Products Sold Query (FIXED: snake_case)
        const productsSoldQuery = `
            SELECT 
                si.productname as productname,
                COALESCE(p.category, 'General') as category,
                SUM(si.quantity) as quantity_sold,
                AVG(si.price) as avg_price,
                SUM(si.quantity * si.price) as total_revenue
            FROM sale_items si
            JOIN sales s ON si.saleid = s.id
            LEFT JOIN products p ON si.productid = p.id
            WHERE ${itemWhere}
            GROUP BY si.productname, p.category
            ORDER BY total_revenue DESC
        `;
        const productsSoldResult = await db.query(productsSoldQuery, itemParams);

        // 4. Stock Remaining Query (with table existence check)
        let stockQuery;
        const stockParams = [];
        
        const tableCheck = await db.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'branch_stock'
            ) as exists
        `);
        const hasBranchStock = tableCheck.rows[0].exists;

        if (branch_id && hasBranchStock) {
            stockQuery = `
                SELECT p.id, p.name, COALESCE(p.category, 'General') as category, p.price,
                       COALESCE(bs.stock, 0) as stock
                FROM products p
                LEFT JOIN branch_stock bs ON p.id = bs.product_id AND bs.branch_id = $1
                ORDER BY p.name ASC
            `;
            stockParams.push(parseInt(branch_id));
        } else if (hasBranchStock) {
            stockQuery = `
                SELECT p.id, p.name, COALESCE(p.category, 'General') as category, p.price,
                       COALESCE(SUM(bs.stock), p.stock, 0) as stock
                FROM products p
                LEFT JOIN branch_stock bs ON p.id = bs.product_id
                GROUP BY p.id, p.name, p.category, p.price, p.stock
                ORDER BY p.name ASC
            `;
        } else {
            // Fallback if branch_stock doesn't exist
            stockQuery = `
                SELECT p.id, p.name, COALESCE(p.category, 'General') as category, p.price,
                       p.stock as stock
                FROM products p
                ORDER BY p.name ASC
            `;
        }
        const stockResult = await db.query(stockQuery, stockParams);

        res.json({
            total_sales: kpi.total_sales,
            total_amount: kpi.total_amount,
            total_pipes_sold: categories.total_pipes_sold,
            total_sacks_sold: categories.total_sacks_sold,
            products_sold: productsSoldResult.rows,
            stock_remaining: stockResult.rows
        });

    } catch (error) {
        console.error('Error generating sales summary report:', error);
        res.status(500).json({ error: 'Failed to generate report', details: error.message });
    }
}));

module.exports = router;