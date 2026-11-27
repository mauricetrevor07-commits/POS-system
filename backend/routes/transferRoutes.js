const express = require('express');
const router = express.Router();
const { randomUUID } = require ('crypto');
const db = require('../database');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

const auth = (req, res, next) => {
    try{
        const token = req.headers['x-auth-token'] || req.headers['authorisation']?.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Unauthorised'});
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

router.get('/', auth, async (req, res) => {
    try {
    const result = await db.query(`
        SELECT t.*,
            b1.name AS from_branch_name,
            b2.name AS to_branch_name
            FROM transfers t
            LEFT JOIN branches b1 ON t.from_branch_id = b1.id
            LEFT JOIN branches b2 ON t.to_branch_id = b2.id
            ORDER BY t.created_at DESC
            `);

            const transfers = result.rows;

            for (let t of transfers) {
                const itemsRes = await db.query(`
                    SELECT ti.*, p.name AS product_name
                    FROM transfer_items ti
                    JOIN products p ON ti.product_id = p.id
                    WHERE ti.transfer_id = $1
                    `, [t.id]);
                    t.items = itemsRes.rows;
            }

            res.json(transfers);
        } catch (err) {
            console.error("GET Transfers Error:", err);
            res.status(500).json({ error: err.message });
        }
});

router.post('/', auth, async (req, res) => {
    const { from_branch_id, to_branch_id, notes, items } = req.body;
    const transferId = randomUUID();
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        await client.query(`
            INSERT INTO transfers (id, from_branch_id, to_branch_id, status, notes, created_by, created_at)
            VALUES ($1, $2, $3, 'pending', $4, $5, NOW())
            `, [transferId, from_branch_id,to_branch_id, notes, req.user.username]);

            for (let item  of items) {
                await client.query(`
                    INSERT INTO transfer_items (transfer_id, product_id, quantity)
                    VALUES ($1, $2, $3)
                    `, [transferId, item.product_id, item.quantity]);

                    const stockCheck = await client.query(
                        `SELECT stock FROM branch_stock WHERE branch_id = $1 AND product_id = $2 FOR UPDATE`,
                        [from_branch_id, item.product_id]
                    );

                    if (!stockCheck.rows.length || stockCheck.rows[0].stock < item.quantity)
                    {
                        throw new Error(`INSUFFICIENT stock for product ID ${item.product_id}
                        `);
                    }

                    await client.query(`
                        UPDATE branch_stock
                        SET stock = stock - $1
                        WHERE branch_id = $2 AND product_id = $3
                        `, [item.quantity, from_branch_id, item.product_id]);
            }

            await client.query('COMMIT');
            res.status(201).json({ id: transferId, message: 'Transfer Initiated' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("POST Transfer Error:", err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

router.put('/:id/receive', auth, async (req, res) => {
    const transferId = req.params.id;
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        const transferRes = await client.query('SELECT * FROM transfers WHERE id = $1 AND status = $2 FOR UPDATE', [transferId,'pending']);
        if (!transferRes.rows.length) throw new Error('Transfer not found or already processed');
        const transfer = transferRes.rows[0];
        const itemsRes = await client.query('SELECT * FROM transfer_items WHERE transfer_id = $1', [transferId]);

        for (let item of itemsRes.rows) {
            await client.query(`
                INSERT INTO branch_stock (branch_id, product_id, stock)
                VALUES ($1, $2, $3)
                ON CONFLICT (branch_id, product_id)
                DO UPDATE SET stock = branch_stock.stock + $3
                `, [transfer.to_branch_id, item.product_id, item.quantity]);
        }

        await client.query(`
            UPDATE transfers
            SET status = 'received', received_by = $1, received_at = NOw()
            WHERE id = $2
            `, [req.user.username, transferId]);

            await client.query('COMMIT');
            res.json({ success:true});
        } catch (err) {
            await client.query('ROLLBACK');
            res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

router.put('/:id/cancel', auth, async (req, res) => {
    const transferId = req.params.id;
    const client = await db.connect();

    try {
        await client.query('BEGIN');

        const transferRes = await client.query('SELECT * FROM transfers WHERE id = $1 AND status = $2 FOR UPDATE', [transferId, 'pending']);
        if (!transferRes.rows.length) throw new Error('Transfer not found or already processed');

        const transfer = transferRes.rows[0];
        const itemsRes = await client.query('SELECT * FROM transfer_items WHERE transfer_id = $1', [transferId]);

        for (let item of itemsRes.rows) {
            await client.query(`
                UPDATE branch_stock
                SET stock = stock + $1
                WHERE branch_id = $2 AND product_id = $3
                `, [item.quantity, transfer.from_branch_id, item.product_id]);
        }

        await client.query(`UPDATE transfers SET status = 'cancelled' WHERE id = $1`, [transferId]);
        await client.query('COMMIT');
        res.json({ success: true});
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

module.exports = router;