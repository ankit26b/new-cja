const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { JWT_SECRET, authMiddleware, adminMiddleware } = require('../middleware/auth');

// First-time admin setup
router.post('/setup-admin', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const adminCountResult = await pool.query(
            "SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'"
        );

        if (adminCountResult.rows[0].count > 0) {
            return res.status(403).json({ error: 'Admin already exists' });
        }

        const existingUser = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role',
            [email, hashedPassword, 'admin']
        );

        const user = result.rows[0];

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'Admin created successfully',
            user: { id: user.id, email: user.email, role: user.role },
            token
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Admin setup failed' });
    }
});

// Register
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        // Check if user exists
        const existingUser = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        const userRole = 'user';

        const result = await pool.query(
            'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role',
            [email, hashedPassword, userRole]
        );

        const user = result.rows[0];

        // Generate token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            user: { id: user.id, email: user.email, role: user.role },
            token
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        // Find user
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        // Check password
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            user: { id: user.id, email: user.email, role: user.role },
            token
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
    res.json({ user: req.user });
});

// List all users (admin only)
router.get('/users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, email, role, created_at FROM users ORDER BY id ASC'
        );
        res.json({ users: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// List all users with assigned site_ids (admin only)
router.get('/users-with-sites', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                u.id,
                u.email,
                u.role,
                u.created_at,
                COALESCE(
                    ARRAY_AGG(us.site_id ORDER BY us.site_id)
                        FILTER (WHERE us.site_id IS NOT NULL),
                    '{}'
                ) AS site_ids
            FROM users u
            LEFT JOIN user_sites us ON us.user_id = u.id
            GROUP BY u.id, u.email, u.role, u.created_at
            ORDER BY u.id ASC
        `);

        res.json({ users: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch users with site access' });
    }
});

// Promote / demote user role (admin only)
router.patch('/users/:id/role', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!role || !['admin', 'user'].includes(role)) {
            return res.status(400).json({ error: "Role must be 'admin' or 'user'" });
        }

        const result = await pool.query(
            'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, role',
            [role, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            message: 'User role updated successfully',
            user: result.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Role update failed' });
    }
});

// Replace assigned sites for a user (admin only)
router.patch('/users/:id/sites', authMiddleware, adminMiddleware, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { site_ids } = req.body;

        if (!Array.isArray(site_ids)) {
            return res.status(400).json({ error: 'site_ids must be an array' });
        }

        const targetUser = await client.query(
            'SELECT id, role FROM users WHERE id = $1',
            [id]
        );

        if (targetUser.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (targetUser.rows[0].role === 'admin') {
            return res.status(400).json({ error: 'Site assignment is managed automatically for master admins' });
        }

        const normalizedSiteIds = [...new Set(site_ids
            .filter((value) => typeof value === 'string')
            .map((value) => value.trim())
            .filter(Boolean))];

        if (normalizedSiteIds.length > 0) {
            const sitesExist = await client.query(
                'SELECT site_id FROM sites WHERE site_id = ANY($1)',
                [normalizedSiteIds]
            );
            if (sitesExist.rows.length !== normalizedSiteIds.length) {
                return res.status(400).json({ error: 'One or more site_ids are invalid' });
            }
        }

        await client.query('BEGIN');
        await client.query('DELETE FROM user_sites WHERE user_id = $1', [id]);

        for (const siteId of normalizedSiteIds) {
            await client.query(
                'INSERT INTO user_sites (user_id, site_id) VALUES ($1, $2)',
                [id, siteId]
            );
        }
        await client.query('COMMIT');

        res.json({
            message: 'Site access updated successfully',
            user_id: Number(id),
            site_ids: normalizedSiteIds,
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: 'Failed to update site access' });
    } finally {
        client.release();
    }
});

module.exports = router;
