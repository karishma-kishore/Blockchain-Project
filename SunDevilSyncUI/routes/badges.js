const express = require('express');
const { isAddress } = require('ethers');
const blockchain = require('../client');
const db = require('../database');

const router = express.Router();

const requireAdmin = (req, res, next) => {
    const user = req.session.user;
    if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
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
            `INSERT INTO minted_badges (token_id, student_wallet, event_id, event_name, event_date, achievement_type, metadata_uri, tx_hash, network)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                result.tokenId,
                studentWallet,
                eventId,
                eventName,
                eventDate,
                achievementType,
                metadataURI,
                result.transactionHash || null,
                result.network || null
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

module.exports = router;
