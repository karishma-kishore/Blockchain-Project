const express = require('express');
const router = express.Router();
const db = require('../database');
const walletService = require('../services/walletService');

// Middleware to check auth
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Get All Groups
router.get('/groups', (req, res) => {
    db.all("SELECT * FROM groups", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        // Parse JSON strings back to arrays
        const groups = rows.map(group => ({
            ...group,
            categories: JSON.parse(group.categories || '[]'),
            benefits: JSON.parse(group.benefits || '[]')
        }));
        res.json(groups);
    });
});

// Get All Events
router.get('/events', (req, res) => {
    db.all("SELECT * FROM events", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const events = rows.map(event => ({
            ...event,
            category: JSON.parse(event.category || '[]'),
            tags: JSON.parse(event.tags || '[]'),
            isFree: !!event.isFree,
            rsvpRequired: !!event.rsvpRequired
        }));
        res.json(events);
    });
});

// Join Group
router.post('/groups/:id/join', requireAuth, (req, res) => {
    const groupId = req.params.id;
    const userId = req.session.user.id;

    db.run(`INSERT OR IGNORE INTO memberships (user_id, group_id) VALUES (?, ?)`, [userId, groupId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Joined group successfully' });
    });
});

// RSVP to an event
router.post('/events/:id/rsvp', requireAuth, (req, res) => {
    const eventId = parseInt(req.params.id);
    const userId = req.session.user.id;

    // Check if already RSVP'd
    db.get('SELECT * FROM rsvps WHERE user_id = ? AND event_id = ?', [userId, eventId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (row) {
            // Un-RSVP
            db.run('DELETE FROM rsvps WHERE user_id = ? AND event_id = ?', [userId, eventId], (err) => {
                if (err) return res.status(500).json({ error: err.message });

                // Increment spots
                db.run('UPDATE events SET spotsLeft = spotsLeft + 1, attendees = attendees - 1 WHERE id = ?', [eventId], (err) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ message: 'RSVP cancelled', status: 'cancelled' });
                });
            });
        } else {
            // Check spots left
            db.get('SELECT spotsLeft FROM events WHERE id = ?', [eventId], (err, event) => {
                if (err) return res.status(500).json({ error: err.message });
                if (!event) return res.status(404).json({ error: 'Event not found' });

                if (event.spotsLeft <= 0) {
                    return res.status(400).json({ error: 'Event is full' });
                }

                // RSVP
                db.run('INSERT INTO rsvps (user_id, event_id) VALUES (?, ?)', [userId, eventId], (err) => {
                    if (err) return res.status(500).json({ error: err.message });

                    // Decrement spots
                    db.run('UPDATE events SET spotsLeft = spotsLeft - 1, attendees = attendees + 1 WHERE id = ?', [eventId], (err) => {
                        if (err) return res.status(500).json({ error: err.message });

                        // Award 10 SDC tokens for RSVP
                        db.run('UPDATE users SET sdc_tokens = sdc_tokens + 10 WHERE id = ?', [userId], (err) => {
                            if (err) return res.status(500).json({ error: err.message });
                            res.json({ message: 'RSVP successful! You earned 10 SDC tokens.', status: 'confirmed', tokensEarned: 10 });
                        });
                    });
                });
            });
        }
    });
});
// Get User Memberships
router.get('/my-groups', requireAuth, (req, res) => {
    const userId = req.session.user.id;
    db.all(`SELECT group_id FROM memberships WHERE user_id = ?`, [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => r.group_id));
    });
});

// Get User RSVPs
router.get('/my-rsvps', requireAuth, (req, res) => {
    const userId = req.session.user.id;
    db.all(`SELECT event_id FROM rsvps WHERE user_id = ?`, [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => r.event_id));
    });
});

// Get User SDC Balance
router.get('/sdc-balance', requireAuth, (req, res) => {
    const userId = req.session.user.id;
    db.get('SELECT sdc_tokens, wallet_address FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json({
            sdcTokens: user.sdc_tokens || 0,
            walletAddress: user.wallet_address
        });
    });
});

// Update User Wallet Address
router.post('/update-wallet', requireAuth, (req, res) => {
    const userId = req.session.user.id;
    const { walletAddress } = req.body;

    if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
    }

    // Basic validation (ethers will do more thorough validation)
    if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
        return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    db.run('UPDATE users SET wallet_address = ? WHERE id = ?', [walletAddress, userId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Wallet address updated successfully', walletAddress });
    });
});

// Convert SDC to Amoy
router.post('/convert-to-amoy', requireAuth, async (req, res) => {
    const userId = req.session.user.id;
    const { sdcAmount, walletAddress } = req.body;

    if (!sdcAmount || sdcAmount <= 0) {
        return res.status(400).json({ error: 'Invalid SDC amount' });
    }

    if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
    }

    try {
        // Get user's current SDC balance
        db.get('SELECT sdc_tokens FROM users WHERE id = ?', [userId], async (err, user) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!user) return res.status(404).json({ error: 'User not found' });

            const currentBalance = user.sdc_tokens || 0;

            // Check if user has enough SDC tokens
            if (currentBalance < sdcAmount) {
                return res.status(400).json({
                    error: 'Insufficient SDC tokens',
                    available: currentBalance,
                    requested: sdcAmount
                });
            }

            try {
                // Calculate Amoy amount
                const amoyAmount = (sdcAmount * 0.0001).toFixed(4);

                // Record the conversion request
                db.run(
                    `INSERT INTO crypto_conversions (user_id, sdc_amount, amoy_amount, wallet_address, status)
                     VALUES (?, ?, ?, ?, 'processing')`,
                    [userId, sdcAmount, amoyAmount, walletAddress],
                    async function(err) {
                        if (err) return res.status(500).json({ error: err.message });

                        const conversionId = this.lastID;

                        try {
                            // Send Amoy tokens via blockchain
                            const txResult = await walletService.sendAmoy(walletAddress, sdcAmount);

                            // Update conversion record with transaction hash
                            db.run(
                                `UPDATE crypto_conversions SET tx_hash = ?, status = 'completed' WHERE id = ?`,
                                [txResult.txHash, conversionId],
                                (err) => {
                                    if (err) console.error('Error updating conversion record:', err);
                                }
                            );

                            // Deduct SDC tokens from user's account
                            db.run(
                                'UPDATE users SET sdc_tokens = sdc_tokens - ?, wallet_address = ? WHERE id = ?',
                                [sdcAmount, walletAddress, userId],
                                (err) => {
                                    if (err) {
                                        console.error('Error updating user balance:', err);
                                        return res.status(500).json({ error: 'Transaction sent but failed to update balance' });
                                    }

                                    res.json({
                                        success: true,
                                        message: `Successfully converted ${sdcAmount} SDC to ${amoyAmount} MATIC`,
                                        txHash: txResult.txHash,
                                        blockNumber: txResult.blockNumber,
                                        amoyAmount: amoyAmount,
                                        sdcAmount: sdcAmount,
                                        remainingSDC: currentBalance - sdcAmount,
                                        explorerUrl: `https://amoy.polygonscan.com/tx/${txResult.txHash}`
                                    });
                                }
                            );

                        } catch (blockchainError) {
                            // Update conversion record to failed
                            db.run(
                                `UPDATE crypto_conversions SET status = 'failed' WHERE id = ?`,
                                [conversionId]
                            );

                            console.error('Blockchain error:', blockchainError);
                            return res.status(500).json({
                                error: 'Failed to send tokens',
                                details: blockchainError.message
                            });
                        }
                    }
                );

            } catch (error) {
                console.error('Conversion error:', error);
                return res.status(500).json({ error: error.message });
            }
        });

    } catch (error) {
        console.error('Error in convert-to-amoy:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get User Conversion History
router.get('/conversion-history', requireAuth, (req, res) => {
    const userId = req.session.user.id;

    db.all(
        `SELECT id, sdc_amount, amoy_amount, wallet_address, tx_hash, status, created_at
         FROM crypto_conversions
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });

            const conversions = rows.map(row => ({
                ...row,
                explorerUrl: row.tx_hash ? `https://amoy.polygonscan.com/tx/${row.tx_hash}` : null
            }));

            res.json(conversions);
        }
    );
});

module.exports = router;
