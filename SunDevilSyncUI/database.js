const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const groupsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'groups.json'), 'utf8'));
const eventsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'events.json'), 'utf8'));

db.serialize(() => {
    // Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        email TEXT UNIQUE,
        role TEXT DEFAULT 'student',
        sdc_tokens INTEGER DEFAULT 100,
        wallet_address TEXT
    )`);

    // Groups Table
    db.run(`CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY,
        name TEXT,
        campus TEXT,
        categories TEXT,
        description TEXT,
        members INTEGER,
        logo TEXT,
        website TEXT,
        contact TEXT,
        points INTEGER,
        mission TEXT,
        benefits TEXT
    )`);

    // Events Table
    db.run(`CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY,
        title TEXT,
        date TEXT,
        time TEXT,
        endTime TEXT,
        location TEXT,
        locationType TEXT,
        campus TEXT,
        description TEXT,
        hostGroup TEXT,
        hostGroupId INTEGER,
        category TEXT,
        eventType TEXT,
        tags TEXT,
        image TEXT,
        isFree INTEGER,
        price INTEGER,
        spotsTotal INTEGER,
        spotsLeft INTEGER,
        attendees INTEGER,
        rsvpRequired INTEGER
    )`);

    // Memberships Table
    db.run(`CREATE TABLE IF NOT EXISTS memberships (
        user_id INTEGER,
        group_id INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(group_id) REFERENCES groups(id),
        PRIMARY KEY (user_id, group_id)
    )`);

    // RSVPs Table
    db.run(`CREATE TABLE IF NOT EXISTS rsvps (
        user_id INTEGER,
        event_id INTEGER,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(event_id) REFERENCES events(id),
        PRIMARY KEY (user_id, event_id)
    )`);

    // Crypto Conversions Table
    db.run(`CREATE TABLE IF NOT EXISTS crypto_conversions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        sdc_amount INTEGER,
        amoy_amount TEXT,
        wallet_address TEXT,
        tx_hash TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Minted Badges Table (off-chain index)
    db.run(`CREATE TABLE IF NOT EXISTS minted_badges (
        token_id INTEGER PRIMARY KEY,
        student_wallet TEXT,
        event_id INTEGER,
        event_name TEXT,
        event_date TEXT,
        achievement_type TEXT,
        metadata_uri TEXT,
        tx_hash TEXT,
        network TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Migration: Add sdc_tokens and wallet_address columns if they don't exist
    db.all("PRAGMA table_info(users)", (err, columns) => {
        const hasSDCTokens = columns.some(col => col.name === 'sdc_tokens');
        const hasWalletAddress = columns.some(col => col.name === 'wallet_address');

        if (!hasSDCTokens) {
            db.run(`ALTER TABLE users ADD COLUMN sdc_tokens INTEGER DEFAULT 100`, (err) => {
                if (!err) {
                    console.log("Added sdc_tokens column to users table.");
                    // Update existing users to have 100 SDC tokens
                    db.run(`UPDATE users SET sdc_tokens = 100 WHERE sdc_tokens IS NULL`);
                }
            });
        }

        if (!hasWalletAddress) {
            db.run(`ALTER TABLE users ADD COLUMN wallet_address TEXT`, (err) => {
                if (!err) console.log("Added wallet_address column to users table.");
            });
        }
    });

    // Seed Groups
    db.get("SELECT count(*) as count FROM groups", (err, row) => {
        if (row.count === 0) {
            const stmt = db.prepare(`INSERT INTO groups VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            groupsData.forEach(group => {
                stmt.run(
                    group.id,
                    group.name,
                    group.campus,
                    JSON.stringify(group.categories),
                    group.description,
                    group.members,
                    group.logo,
                    group.website,
                    group.contact,
                    group.points,
                    group.mission,
                    JSON.stringify(group.benefits)
                );
            });
            stmt.finalize();
            console.log("Groups seeded.");
        }
    });

    // Seed Events
    db.get("SELECT count(*) as count FROM events", (err, row) => {
        if (row.count === 0) {
            const stmt = db.prepare(`INSERT INTO events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            eventsData.forEach(event => {
                stmt.run(
                    event.id,
                    event.title,
                    event.date,
                    event.time,
                    event.endTime,
                    event.location,
                    event.locationType,
                    event.campus,
                    event.description,
                    event.hostGroup,
                    event.hostGroupId,
                    JSON.stringify(event.category),
                    event.eventType,
                    JSON.stringify(event.tags),
                    event.image,
                    event.isFree ? 1 : 0,
                    event.price || 0,
                    event.spotsTotal,
                    event.spotsLeft,
                    event.attendees,
                    event.rsvpRequired ? 1 : 0
                );
            });
            stmt.finalize();
            console.log("Events seeded.");
        }
    });

    // Create default test users
    db.get("SELECT count(*) as count FROM users", (err, row) => {
        if (row.count === 0) {
            const passwordHash = bcrypt.hashSync('password123', 10);
            db.run(`INSERT INTO users (username, password, email) VALUES (?, ?, ?)`,
                ['student', passwordHash, 'student@asu.edu'],
                (err) => {
                    if (!err) console.log("Default user 'student' created.");
                }
            );
            db.run(`INSERT INTO users (username, password, email) VALUES (?, ?, ?)`,
                ['Student1', passwordHash, 'student1@asu.edu'],
                (err) => {
                    if (!err) console.log("Default user 'Student1' created.");
                }
            );
        }
    });

    // Ensure admin user exists for minting badges
    const adminPasswordHash = bcrypt.hashSync('adminpass123', 10);
    db.get("SELECT * FROM users WHERE username = ?", ['admin'], (err, admin) => {
        if (err) {
            console.error('Error checking admin user:', err);
            return;
        }
        if (!admin) {
            db.run(
                `INSERT INTO users (username, password, email, role, sdc_tokens) VALUES (?, ?, ?, 'admin', 0)`,
                ['admin', adminPasswordHash, 'admin@asu.edu'],
                (insertErr) => {
                    if (insertErr && insertErr.message.includes('UNIQUE')) {
                        console.warn("Admin user already exists but couldn't be fetched initially.");
                    } else if (!insertErr) {
                        console.log("Default admin user 'admin' created.");
                    }
                }
            );
        } else if (admin.role !== 'admin') {
            db.run(`UPDATE users SET role = 'admin' WHERE username = ?`, ['admin'], (updateErr) => {
                if (updateErr) console.error('Failed to elevate admin user role:', updateErr);
            });
        }
    });
});

module.exports = db;
