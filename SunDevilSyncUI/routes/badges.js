const express = require('express');
const { isAddress } = require('ethers');
const blockchain = require('../blockchain/client');
const db = require('../database');
const sdc = require('../blockchain/sdcClient');

const router = express.Router();

// Helpers for sqlite promises
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

const requireAdmin = (req, res, next) => {
    const user = req.session.user;
    if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
};

const requireRole = (roles) => (req, res, next) => {
    const user = req.session.user;
    if (!user || !roles.includes(user.role)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    next();
};

router.get('/badges/status', (req, res) => {
    res.json({
        configured: blockchain.isConfigured(),
        usesMock: blockchain.usesMock(),
    });
});

// List recently minted badges (off-chain index for quick UI display)
router.get('/badges', async (req, res) => {
    db.all(`SELECT * FROM minted_badges ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) {
            console.error('Fetch badges error:', err);
            return res.status(500).json({ error: 'Failed to load badges' });
        }
        res.json(rows);
    });
});

// List badges for the current user
router.get('/my-badges', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const wallet = req.session.user.wallet_address;
        if (!wallet) return res.status(400).json({ error: 'Add a wallet address first' });

        const badges = await dbAll(
            `SELECT * FROM minted_badges
             WHERE student_wallet = ? OR user_id = ?
             ORDER BY created_at DESC`,
            [wallet, userId]
        );
        res.json(badges);
    } catch (err) {
        console.error('My badges error:', err);
        res.status(500).json({ error: 'Failed to load badges' });
    }
});

// Badges issued by current user (verifiers/admins)
router.get('/badges/issued-by-me', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const badges = await dbAll(
            `SELECT * FROM minted_badges
             WHERE minted_by = ?
             ORDER BY created_at DESC`,
            [userId]
        );
        res.json(badges);
    } catch (err) {
        console.error('Issued-by-me error:', err);
        res.status(500).json({ error: 'Failed to load badges' });
    }
});

router.post('/badges/mint', requireAdmin, async (req, res) => {
    const { studentWallet, eventId, eventName, eventDate, achievementType, metadataURI } = req.body;

    if (!studentWallet || !isAddress(studentWallet)) {
        return res.status(400).json({ error: 'Valid studentWallet address required' });
    }
    if (!eventId || !metadataURI || !eventName || !eventDate || !achievementType) {
        return res.status(400).json({ error: 'eventId, eventName, eventDate, achievementType, metadataURI are required' });
    }

    try {
        const result = await blockchain.issueBadge({
            student: studentWallet,
            eventId: Number(eventId),
            eventName,
            eventDate,
            achievementType,
            metadataURI
        });
        res.json({
            message: 'Badge minted',
            ...result
        });

        // Persist off-chain index
        db.run(
            `INSERT INTO minted_badges (token_id, student_wallet, event_id, event_name, event_date, achievement_type, metadata_uri, tx_hash, network, minted_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                result.tokenId,
                studentWallet,
                eventId,
                eventName,
                eventDate,
                achievementType,
                metadataURI,
                result.transactionHash || null,
                result.network || null,
                req.session?.user?.id || null
            ],
            (err) => {
                if (err) console.error('Failed to persist minted badge:', err);
            }
        );
    } catch (err) {
        console.error('Mint error:', err);
        res.status(500).json({ error: err.message || 'Failed to mint badge' });
    }
});

// Verifier/Admin: convert enrolled badge to attended badge
router.post('/badges/attend', requireRole(['verifier', 'admin']), async (req, res) => {
    const { enrollmentTokenId } = req.body;
    const tokenId = Number(enrollmentTokenId);
    if (!Number.isInteger(tokenId) || tokenId <= 0) {
        return res.status(400).json({ error: 'Valid enrollment tokenId required' });
    }

    try {
        const enrollment = await dbGet(
            'SELECT * FROM minted_badges WHERE token_id = ? AND achievement_type = ?',
            [tokenId, 'enrolled']
        );
        if (!enrollment) return res.status(404).json({ error: 'Enrollment badge not found' });

        if (!enrollment.student_wallet || !isAddress(enrollment.student_wallet)) {
            return res.status(400).json({ error: 'Invalid student wallet for this badge' });
        }

        const existing = await dbGet(
            'SELECT * FROM minted_badges WHERE student_wallet = ? AND event_id = ? AND achievement_type = ?',
            [enrollment.student_wallet, enrollment.event_id, 'attended']
        );
        if (existing) {
            return res.status(409).json({ error: 'Attended badge already minted', tokenId: existing.token_id });
        }

        const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
        const metadataURI = `${baseUrl.replace(/\/$/, '')}/event-detail.html?id=${enrollment.event_id}`;
        const result = await blockchain.issueBadge({
            student: enrollment.student_wallet,
            eventId: Number(enrollment.event_id),
            eventName: enrollment.event_name,
            eventDate: enrollment.event_date,
            achievementType: 'attended',
            metadataURI
        });

        await dbRun(
            `INSERT INTO minted_badges (token_id, student_wallet, user_id, event_id, event_name, event_date, achievement_type, metadata_uri, tx_hash, network, minted_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                result.tokenId,
                enrollment.student_wallet,
                enrollment.user_id || null,
                enrollment.event_id,
                enrollment.event_name,
                enrollment.event_date,
                'attended',
                metadataURI,
                result.transactionHash || null,
                result.network || null,
                req.session?.user?.id || null
            ]
        );

        // Reward SDC for attendance (default 100)
        let reward = null;
        try {
            reward = await rewardSdc(enrollment.student_wallet, process.env.SDC_REWARD_ATTEND || 100);
        } catch (err) {
            console.error('SDC reward (attend) failed:', err.message || err);
        }

        res.json({
            message: 'Attended badge minted',
            tokenId: result.tokenId,
            transactionHash: result.transactionHash,
            network: result.network,
            metadataURI,
            sdcReward: reward
        });
    } catch (err) {
        console.error('Attended mint error:', err);
        res.status(500).json({ error: err.message || 'Failed to mint attended badge' });
    }
});

router.get('/badges/:tokenId', async (req, res) => {
    const tokenId = Number(req.params.tokenId);
    if (!Number.isInteger(tokenId) || tokenId <= 0) {
        return res.status(400).json({ error: 'Invalid tokenId' });
    }

    try {
        const badge = await blockchain.getBadge(tokenId);
        res.json(badge);
    } catch (err) {
        console.error('Get badge error:', err);
        res.status(404).json({ error: err.message || 'Badge not found' });
    }
});

async function rewardSdc(toWallet, amount) {
    if (!toWallet) return null;
    if (!process.env.SDC_TOKEN_ADDRESS) return null;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return null;
    try {
        const res = await sdc.transfer(process.env.STORE_WALLET_ADDRESS || toWallet, toWallet, numericAmount);
        db.run('UPDATE users SET sdc_tokens = COALESCE(sdc_tokens, 0) + ? WHERE wallet_address = ?', [numericAmount, toWallet], (err) => {
            if (err) console.error('Failed to update off-chain SDC balance:', err);
        });
        return { amount: numericAmount, hash: res.hash, network: res.network };
    } catch (err) {
        console.error('SDC reward error:', err.message || err);
        return null;
    }
}

module.exports = router;
