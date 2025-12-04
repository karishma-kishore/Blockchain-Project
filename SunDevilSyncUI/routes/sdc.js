const express = require('express');
const router = express.Router();
const db = require('../database');
const sdcTokenService = require('../services/sdcTokenService');

// Middleware to check auth
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Middleware to check admin
const requireAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

/**
 * GET /api/sdc/status
 * Get SDC token service status
 */
router.get('/status', (req, res) => {
    res.json({
        configured: sdcTokenService.isConfigured(),
        mockMode: sdcTokenService.usesMock(),
        serviceWallet: sdcTokenService.getServiceWalletAddress(),
        rewardAmounts: sdcTokenService.getRewardAmounts()
    });
});

/**
 * GET /api/sdc/balance/:address
 * Get on-chain SDC balance for a wallet address
 */
router.get('/balance/:address', async (req, res) => {
    try {
        const { address } = req.params;

        if (!address || !address.startsWith('0x') || address.length !== 42) {
            return res.status(400).json({ error: 'Invalid wallet address' });
        }

        const balance = await sdcTokenService.getBalance(address);
        res.json({ address, balance, unit: 'SDC' });
    } catch (error) {
        console.error('Error getting balance:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/sdc/my-balance
 * Get current user's on-chain SDC balance (requires wallet_address set)
 */
router.get('/my-balance', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;

        db.get('SELECT wallet_address, sdc_tokens FROM users WHERE id = ?', [userId], async (err, user) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!user) return res.status(404).json({ error: 'User not found' });

            const response = {
                offChainBalance: user.sdc_tokens || 0,
                walletAddress: user.wallet_address
            };

            // If user has wallet address, also get on-chain balance
            if (user.wallet_address) {
                try {
                    const onChainBalance = await sdcTokenService.getBalance(user.wallet_address);
                    const stats = await sdcTokenService.getUserStats(user.wallet_address);
                    response.onChainBalance = onChainBalance;
                    response.totalRewardsEarned = stats.totalRewardsEarned;
                    response.rewardCount = stats.rewardCount;
                } catch (e) {
                    response.onChainBalance = 'Unable to fetch';
                    response.onChainError = e.message;
                }
            }

            res.json(response);
        });
    } catch (error) {
        console.error('Error getting my balance:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/sdc/stats
 * Get token supply statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await sdcTokenService.getSupplyStats();
        res.json(stats);
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/sdc/claim-rewards
 * Claim off-chain SDC tokens to on-chain wallet
 */
router.post('/claim-rewards', requireAuth, async (req, res) => {
    const userId = req.session.user.id;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
    }

    try {
        db.get('SELECT sdc_tokens, wallet_address FROM users WHERE id = ?', [userId], async (err, user) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!user) return res.status(404).json({ error: 'User not found' });

            if (!user.wallet_address) {
                return res.status(400).json({ error: 'Please set your wallet address first' });
            }

            const currentBalance = user.sdc_tokens || 0;
            if (currentBalance < amount) {
                return res.status(400).json({
                    error: 'Insufficient off-chain balance',
                    available: currentBalance,
                    requested: amount
                });
            }

            try {
                // Distribute real SDC tokens on-chain
                const result = await sdcTokenService.distributeReward(
                    user.wallet_address,
                    amount,
                    'CLAIM',
                    `claim_${userId}_${Date.now()}`
                );

                // Deduct from off-chain balance
                db.run('UPDATE users SET sdc_tokens = sdc_tokens - ? WHERE id = ?', [amount, userId], (err) => {
                    if (err) {
                        console.error('Error updating balance:', err);
                        return res.status(500).json({
                            error: 'Tokens sent but failed to update balance',
                            txHash: result.txHash
                        });
                    }

                    // Record the claim
                    db.run(
                        `INSERT INTO sdc_claims (user_id, amount, wallet_address, tx_hash, status)
                         VALUES (?, ?, ?, ?, 'completed')`,
                        [userId, amount, user.wallet_address, result.txHash],
                        (err) => {
                            if (err) console.error('Error recording claim:', err);
                        }
                    );

                    res.json({
                        success: true,
                        message: `Successfully claimed ${amount} SDC tokens to your wallet`,
                        txHash: result.txHash,
                        blockNumber: result.blockNumber,
                        amount,
                        remainingOffChain: currentBalance - amount,
                        explorerUrl: result.mock ? null : `https://amoy.polygonscan.com/tx/${result.txHash}`
                    });
                });
            } catch (blockchainError) {
                console.error('Blockchain error:', blockchainError);
                return res.status(500).json({
                    error: 'Failed to send tokens',
                    details: blockchainError.message
                });
            }
        });
    } catch (error) {
        console.error('Error claiming rewards:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/sdc/distribute-reward
 * Admin: Distribute reward tokens to a user
 */
router.post('/distribute-reward', requireAdmin, async (req, res) => {
    const { walletAddress, amount, rewardType, referenceId } = req.body;

    if (!walletAddress || !amount || !rewardType) {
        return res.status(400).json({ error: 'walletAddress, amount, and rewardType are required' });
    }

    if (!walletAddress.startsWith('0x') || walletAddress.length !== 42) {
        return res.status(400).json({ error: 'Invalid wallet address' });
    }

    try {
        const result = await sdcTokenService.distributeReward(
            walletAddress,
            amount,
            rewardType,
            referenceId || ''
        );

        // Record the distribution
        db.run(
            `INSERT INTO sdc_distributions (wallet_address, amount, reward_type, reference_id, tx_hash, admin_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [walletAddress, amount, rewardType, referenceId || '', result.txHash, req.session.user.id],
            (err) => {
                if (err) console.error('Error recording distribution:', err);
            }
        );

        res.json({
            success: true,
            message: `Distributed ${amount} SDC tokens for ${rewardType}`,
            ...result,
            explorerUrl: result.mock ? null : `https://amoy.polygonscan.com/tx/${result.txHash}`
        });
    } catch (error) {
        console.error('Error distributing reward:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/sdc/batch-distribute
 * Admin: Batch distribute rewards to multiple users
 */
router.post('/batch-distribute', requireAdmin, async (req, res) => {
    const { recipients, rewardType, referenceId } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: 'recipients array is required' });
    }

    if (!rewardType) {
        return res.status(400).json({ error: 'rewardType is required' });
    }

    // Validate all recipients
    for (const recipient of recipients) {
        if (!recipient.address || !recipient.address.startsWith('0x') || recipient.address.length !== 42) {
            return res.status(400).json({ error: `Invalid address: ${recipient.address}` });
        }
        if (!recipient.amount || recipient.amount <= 0) {
            return res.status(400).json({ error: `Invalid amount for ${recipient.address}` });
        }
    }

    try {
        const result = await sdcTokenService.batchDistributeReward(
            recipients,
            rewardType,
            referenceId || ''
        );

        res.json({
            success: true,
            message: `Distributed rewards to ${recipients.length} recipients`,
            ...result,
            explorerUrl: result.mock ? null : `https://amoy.polygonscan.com/tx/${result.txHash}`
        });
    } catch (error) {
        console.error('Error batch distributing:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/sdc/mint
 * Admin: Mint new SDC tokens
 */
router.post('/mint', requireAdmin, async (req, res) => {
    const { to, amount, reason } = req.body;

    if (!to || !amount) {
        return res.status(400).json({ error: 'to and amount are required' });
    }

    if (!to.startsWith('0x') || to.length !== 42) {
        return res.status(400).json({ error: 'Invalid wallet address' });
    }

    try {
        const result = await sdcTokenService.mint(to, amount, reason || 'Admin mint');

        // Record the mint
        db.run(
            `INSERT INTO sdc_mints (wallet_address, amount, reason, tx_hash, admin_id)
             VALUES (?, ?, ?, ?, ?)`,
            [to, amount, reason || 'Admin mint', result.txHash, req.session.user.id],
            (err) => {
                if (err) console.error('Error recording mint:', err);
            }
        );

        res.json({
            success: true,
            message: `Minted ${amount} SDC tokens`,
            ...result,
            explorerUrl: result.mock ? null : `https://amoy.polygonscan.com/tx/${result.txHash}`
        });
    } catch (error) {
        console.error('Error minting:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/sdc/verify/:txHash
 * Verify a transaction on the blockchain
 */
router.get('/verify/:txHash', async (req, res) => {
    try {
        const { txHash } = req.params;
        const result = await sdcTokenService.verifyTransaction(txHash);
        res.json(result);
    } catch (error) {
        console.error('Error verifying transaction:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/sdc/claim-history
 * Get user's claim history
 */
router.get('/claim-history', requireAuth, (req, res) => {
    const userId = req.session.user.id;

    db.all(
        `SELECT id, amount, wallet_address, tx_hash, status, created_at
         FROM sdc_claims
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });

            const claims = rows.map(row => ({
                ...row,
                explorerUrl: row.tx_hash && !row.tx_hash.startsWith('0xmock')
                    ? `https://amoy.polygonscan.com/tx/${row.tx_hash}`
                    : null
            }));

            res.json(claims);
        }
    );
});

module.exports = router;
