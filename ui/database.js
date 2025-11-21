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
        role TEXT DEFAULT 'student'
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

    // Create a default test user
    db.get("SELECT count(*) as count FROM users", (err, row) => {
        if (row.count === 0) {
            const passwordHash = bcrypt.hashSync('password123', 10);
            db.run(`INSERT INTO users (username, password, email) VALUES (?, ?, ?)`,
                ['student', passwordHash, 'student@asu.edu'],
                (err) => {
                    if (!err) console.log("Default user 'student' created.");
                }
            );
        }
    });
});

module.exports = db;
