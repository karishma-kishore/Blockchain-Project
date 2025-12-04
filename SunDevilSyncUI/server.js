require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const db = require('./database');
const badgeRoutes = require('./routes/badges');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '.'))); // Serve static files from root

// Session Setup
app.use(session({
    secret: 'sundevil_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false, // Keep false to work with both HTTP and HTTPS
        sameSite: 'lax', // Allow cookies to work with tunnels
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Routes
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const sdcRoutes = require('./routes/sdc');

app.use('/api', authRoutes);
app.use('/api', apiRoutes);
app.use('/api', badgeRoutes);
app.use('/api/sdc', sdcRoutes);

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
