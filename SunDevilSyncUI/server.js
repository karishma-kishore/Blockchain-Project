require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const IS_PROD = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');

if (!process.env.SESSION_SECRET) {
    console.warn('SESSION_SECRET is not set. Using a temporary random secret — set SESSION_SECRET in .env for stable sessions.');
}

// Middleware
app.use(cors({
    origin: true, // reflect request origin for local dev or proxies
    credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Hardened session setup
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: IS_PROD
    }
}));

// Static assets (only expose front-end files, not the whole repo)
const staticDirs = ['css', 'js', 'images', 'data'];
staticDirs.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (fs.existsSync(dirPath)) {
        app.use(`/${dir}`, express.static(dirPath, { maxAge: '1h' }));
    }
});

// Serve public HTML pages explicitly to avoid leaking server files
const pages = [
    'index',
    'groups',
    'group-detail',
    'events',
    'event-detail',
    'dashboard',
    'my-events',
    'collectibles',
    'store',
    'portal',
    'admin',
    'badges',
    'verify'
];

const sendPage = (page) => (req, res) => res.sendFile(path.join(__dirname, `${page}.html`));

app.get('/', sendPage('index'));
pages.forEach((page) => {
    app.get(`/${page}.html`, sendPage(page));
    app.get(`/${page}`, sendPage(page)); // allow extensionless route
});

// Routes
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const badgeRoutes = require('./routes/badges');
const sdcRoutes = require('./routes/sdc');

app.use('/api', authRoutes);
app.use('/api', apiRoutes);
app.use('/api', badgeRoutes);
app.use('/api/sdc', sdcRoutes);

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
