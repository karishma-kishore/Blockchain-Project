
const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');

// Load events data
const eventsPath = path.join(__dirname, 'events.json');
let eventsData = [];
if (fs.existsSync(eventsPath)) {
    try {
        eventsData = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
    } catch (err) {
        console.error("Error reading events.json:", err);
    }
}

// Set URL to IDs for easier lookup if needed, checking for duplicates?
// eventsData is an array.

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
// We need to serve the current directory's assets basically.
// Ideally we'd move them to 'public' but to minimize breakage we'll serve specific folders.
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use('/upload', express.static(path.join(__dirname, 'upload')));
app.use('/bower_components', express.static(path.join(__dirname, 'bower_components')));
app.use('/glyphicons-pro', express.static(path.join(__dirname, 'glyphicons-pro')));
app.use('/angular_elements', express.static(path.join(__dirname, 'angular_elements')));

// Routes

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/events', (req, res) => {
    // Pass events data to the template
    res.render('events', { events: eventsData });
});

app.get('/rsvp', (req, res) => {
    const eventId = req.query.id;
    const event = eventsData.find(e => e.id == eventId);

    if (event) {
        res.render('rsvp', { event: event });
    } else {
        res.status(404).send('Event not found');
    }
});

// Fallback for rsvp_boot (old links if any remain)
app.get('/rsvp_boot', (req, res) => {
    res.redirect(`/rsvp?id=${req.query.id}`);
});

// .html Routes (Aliases)
app.get('/index.html', (req, res) => res.render('index'));
app.get('/home.html', (req, res) => res.render('home'));
app.get('/events.html', (req, res) => res.render('events', { events: eventsData }));
app.get('/rsvp.html', (req, res) => {
    const eventId = req.query.id;
    const event = eventsData.find(e => e.id == eventId);
    if (event) {
        res.render('rsvp', { event: event });
    } else {
        res.status(404).send('Event not found');
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
