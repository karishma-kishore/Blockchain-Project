const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database');

// Register
router.post('/register', (req, res) => {
    const { username, password, email } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);

    db.run(`INSERT INTO users (username, password, email) VALUES (?, ?, ?)`,
        [username, hashedPassword, email],
        function (err) {
            if (err) {
                return res.status(400).json({ error: err.message });
            }
            res.json({ id: this.lastID, username, email });
        }
    );
});

// Login
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(400).json({ error: 'User not found' });

        if (bcrypt.compareSync(password, user.password)) {
            req.session.user = { id: user.id, username: user.username, email: user.email, role: user.role };
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

module.exports = router;
