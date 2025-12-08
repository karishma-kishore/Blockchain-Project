const express = require('express');
const router = express.Router();
const db = require('../database');
const walletService = require('../services/walletService');
const blockchain = require('../blockchain/client');
const sdc = require('../blockchain/sdcClient');
const { isAddress } = require('ethers');

// Promise helpers for sqlite callbacks
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

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

// Join/Leave Group (toggle)
router.post('/groups/:id/join', requireAuth, (req, res) => {
    const groupId = parseInt(req.params.id, 10);
    const userId = req.session.user.id;

    if (!Number.isInteger(groupId)) {
        return res.status(400).json({ error: 'Invalid group id' });
    }

    db.get('SELECT 1 FROM groups WHERE id = ?', [groupId], (err, group) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!group) return res.status(404).json({ error: 'Group not found' });

        db.get('SELECT 1 FROM memberships WHERE user_id = ? AND group_id = ?', [userId, groupId], (err, existing) => {
            if (err) return res.status(500).json({ error: err.message });

            if (existing) {
                db.run('DELETE FROM memberships WHERE user_id = ? AND group_id = ?', [userId, groupId], function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    db.run('UPDATE groups SET members = MAX(members - 1, 0) WHERE id = ?', [groupId]);
                    return res.json({ message: 'Left group', status: 'left' });
                });
            } else {
                db.run('INSERT INTO memberships (user_id, group_id) VALUES (?, ?)', [userId, groupId], function (err) {
                    if (err) return res.status(500).json({ error: err.message });
                    db.run('UPDATE groups SET members = members + 1 WHERE id = ?', [groupId]);
                    return res.json({ message: 'Joined group successfully', status: 'joined' });
                });
            }
        });
    });
});

// RSVP to an event
router.post('/events/:id/rsvp', requireAuth, async (req, res) => {
    const eventId = parseInt(req.params.id, 10);
    const userId = req.session.user.id;

    if (!Number.isInteger(eventId)) {
        return res.status(400).json({ error: 'Invalid event id' });
    }

    try {
        const user = await dbGet('SELECT wallet_address FROM users WHERE id = ?', [userId]);
        const wallet = user ? user.wallet_address : null;

        const existing = await dbGet('SELECT 1 FROM rsvps WHERE user_id = ? AND event_id = ?', [userId, eventId]);
        if (existing) {
            await dbRun('DELETE FROM rsvps WHERE user_id = ? AND event_id = ?', [userId, eventId]);
            await dbRun('UPDATE events SET spotsLeft = spotsLeft + 1, attendees = attendees - 1 WHERE id = ?', [eventId]);
            return res.json({ message: 'RSVP cancelled', status: 'cancelled' });
        }

        if (!wallet) {
            return res.status(400).json({ error: 'Add a wallet address in your portal before enrolling.' });
        }

        const event = await dbGet('SELECT * FROM events WHERE id = ?', [eventId]);
        if (!event) return res.status(404).json({ error: 'Event not found' });

        if (event.spotsLeft <= 0) {
            return res.status(400).json({ error: 'Event is full' });
        }

        await dbRun('INSERT INTO rsvps (user_id, event_id) VALUES (?, ?)', [userId, eventId]);
        await dbRun('UPDATE events SET spotsLeft = spotsLeft - 1, attendees = attendees + 1 WHERE id = ?', [eventId]);

        const badge = await mintEnrollmentBadge({ userId, wallet, event });

        // Reward SDC for enrollment (default 50)
        const sdcReward = await rewardSdc(wallet, process.env.SDC_REWARD_ENROLL || 50);

        res.json({ message: 'RSVP successful', status: 'confirmed', badge, sdc: sdcReward });
    } catch (err) {
        console.error('RSVP error:', err);
        res.status(500).json({ error: 'Failed to RSVP' });
    }
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
router.get('/sdc-balance', requireAuth, async (req, res) => {
    const userId = req.session.user.id;
    const wallet = req.session.user.wallet_address;
    
    try {
        const user = await dbGet('SELECT sdc_tokens, wallet_address FROM users WHERE id = ?', [userId]);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Include both local SDC tokens and on-chain balance if wallet exists
        let onChainBalance = null;
        if (wallet) {
            try {
                const result = await sdc.getBalance(wallet);
                onChainBalance = {
                    balance: result.balance.toString(),
                    symbol: result.symbol || 'SDC',
                    decimals: result.decimals,
                    mock: result.mock
                };
            } catch (e) {
                console.error('Failed to fetch on-chain balance:', e.message);
            }
        }

        res.json({
            sdcTokens: user.sdc_tokens || 0,
            walletAddress: user.wallet_address,
            onChain: onChainBalance
        });
    } catch (err) {
        console.error('SDC balance error:', err);
        res.status(500).json({ error: err.message });
    }
});

// SDC balance (on-chain)
router.get('/sdc/balance', requireAuth, async (req, res) => {
    const wallet = req.session.user.wallet_address;
    if (!wallet) return res.status(400).json({ error: 'Add a wallet address first' });
    try {
        const result = await sdc.getBalance(wallet);
        res.json({
            wallet,
            balance: result.balance.toString(),
            symbol: result.symbol || 'SDC',
            decimals: result.decimals,
            mock: result.mock
        });
    } catch (err) {
        console.error('SDC balance error:', err);
        res.status(500).json({ error: err.message || 'Failed to load balance' });
    }
});

// SDC transfer
router.post('/sdc/transfer', requireAuth, async (req, res) => {
    const wallet = req.session.user.wallet_address;
    if (!wallet) return res.status(400).json({ error: 'Add a wallet address first' });

    const { to, amount } = req.body;
    if (!to) return res.status(400).json({ error: 'Recipient address required' });
    if (!isAddress(to)) return res.status(400).json({ error: 'Recipient address is invalid' });
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    try {
        const result = await sdc.transfer(wallet, to, parsedAmount);
        res.json({
            message: 'Transfer sent',
            hash: result.hash,
            network: result.network || (result.mock ? 'mock' : null)
        });
    } catch (err) {
        console.error('SDC transfer error:', err);
        res.status(400).json({ error: err.message || 'Failed to transfer' });
    }
});

// SDC config for front-end (public)
router.get('/sdc/config', async (_req, res) => {
    try {
        const network = await sdc.getNetworkLabel();
        res.json({
            tokenAddress: process.env.SDC_TOKEN_ADDRESS || null,
            decimals: Number(process.env.SDC_DECIMALS || 18),
            network,
            mock: sdc.usesMock(),
            storeWallet: process.env.STORE_WALLET_ADDRESS || null
        });
    } catch (err) {
        res.json({
            tokenAddress: process.env.SDC_TOKEN_ADDRESS || null,
            decimals: Number(process.env.SDC_DECIMALS || 18),
            network: 'unknown',
            mock: sdc.usesMock(),
            storeWallet: process.env.STORE_WALLET_ADDRESS || null
        });
    }
});

// Update User Wallet Address
router.post('/update-wallet', requireAuth, (req, res) => {
    const userId = req.session.user.id;
    const { walletAddress } = req.body;

    if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
    }

    if (!isAddress(walletAddress)) {
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

// Helpers
async function mintEnrollmentBadge({ userId, wallet, event }) {
    const existing = await dbGet(
        'SELECT * FROM minted_badges WHERE student_wallet = ? AND event_id = ? AND achievement_type = ?',
        [wallet, event.id, 'enrolled']
    );
    if (existing) {
        return {
            alreadyMinted: true,
            tokenId: existing.token_id,
            transactionHash: existing.tx_hash,
            network: existing.network,
            metadataURI: existing.metadata_uri,
            achievementType: 'enrolled'
        };
    }

    const ownerFragment = userId || wallet;
    const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
    const metadataURI = `${baseUrl.replace(/\/$/, '')}/event-detail.html?id=${event.id}`;
    const result = await blockchain.issueBadge({
        student: wallet,
        eventId: Number(event.id),
        eventName: event.title,
        eventDate: event.date,
        achievementType: 'enrolled',
        metadataURI
    });

    await dbRun(
        `INSERT INTO minted_badges (token_id, student_wallet, user_id, event_id, event_name, event_date, achievement_type, metadata_uri, tx_hash, network, minted_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            result.tokenId,
            wallet,
            userId,
            event.id,
            event.title,
            event.date,
            'enrolled',
            metadataURI,
            result.transactionHash || null,
            result.network || null,
            null
        ]
    );

    return {
        tokenId: result.tokenId,
        transactionHash: result.transactionHash,
        network: result.network,
        metadataURI,
        achievementType: 'enrolled'
    };
}

async function rewardSdc(toWallet, amount) {
    if (!toWallet) return null;
    if (!process.env.SDC_TOKEN_ADDRESS) return null;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return null;
    try {
        const res = await sdc.transfer(process.env.STORE_WALLET_ADDRESS || toWallet, toWallet, numericAmount);
        // Mirror on-chain reward to off-chain balance for quick UI display
        db.run('UPDATE users SET sdc_tokens = COALESCE(sdc_tokens, 0) + ? WHERE wallet_address = ?', [numericAmount, toWallet], (err) => {
            if (err) console.error('Failed to update off-chain SDC balance:', err);
        });
        return { amount: numericAmount, hash: res.hash, network: res.network };
    } catch (err) {
        console.error('SDC reward error:', err.message || err);
        return null;
    }
}
