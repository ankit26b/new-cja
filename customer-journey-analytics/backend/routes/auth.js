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

module.exports = router;
