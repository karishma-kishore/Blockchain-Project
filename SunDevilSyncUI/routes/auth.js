const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database');
const { isAddress } = require('ethers');

// Register
router.post('/register', (req, res) => {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
        return res.status(400).json({ error: 'username, password, and email are required' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    db.run(`INSERT INTO users (username, password, email) VALUES (?, ?, ?)`,
        [username, hashedPassword, email],
        function (err) {
            if (err) {
                if (err.message && err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ error: 'Username or email already in use' });
                }
                return res.status(400).json({ error: 'Could not create user' });
            }
            res.json({ id: this.lastID, username, email });
        }
    );
});

// Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(400).json({ error: 'User not found' });

        if (bcrypt.compareSync(password, user.password)) {
            req.session.user = { id: user.id, username: user.username, email: user.email, role: user.role, wallet_address: user.wallet_address };
            res.json({ message: 'Logged in successfully', user: req.session.user });
        } else {
            res.status(400).json({ error: 'Invalid password' });
        }
    });
});

// Get Current User
router.get('/me', (req, res) => {
    if (req.session.user) {
        res.json({ user: req.session.user });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out' });
});

// Update wallet address
router.post('/me/wallet', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const { wallet } = req.body;
    if (!wallet || !isAddress(wallet)) {
        return res.status(400).json({ error: 'Valid wallet address required' });
    }

    db.run(`UPDATE users SET wallet_address = ? WHERE id = ?`, [wallet, req.session.user.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        req.session.user.wallet_address = wallet;
        res.json({ wallet });
    });
});

module.exports = router;
