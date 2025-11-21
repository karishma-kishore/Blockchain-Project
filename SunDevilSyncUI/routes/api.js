const express = require('express');
const router = express.Router();
const db = require('../database');

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
                        res.json({ message: 'RSVP successful', status: 'confirmed' });
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

module.exports = router;
