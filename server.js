
// Load environment variables
require('dotenv').config();

const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');
const { ethers } = require('ethers');

// Blockchain configuration
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL || 'https://rpc-amoy.polygon.technology';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0x00485658Ba58bBD39F18a419FCE4F8488b7e136d';

// SDC Token ABI (includes mint for claiming)
const SDC_ABI = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function mint(address to, uint256 amount)"
];

// Initialize blockchain provider and wallet
let provider, wallet, sdcContract;
try {
    provider = new ethers.JsonRpcProvider(RPC_URL);
    if (PRIVATE_KEY) {
        wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        sdcContract = new ethers.Contract(CONTRACT_ADDRESS, SDC_ABI, wallet);
        console.log(`Blockchain wallet initialized: ${wallet.address}`);
    } else {
        console.warn('Warning: PRIVATE_KEY not set in .env - blockchain claiming disabled');
    }
} catch (err) {
    console.error('Error initializing blockchain:', err);
}

// Load events data
const eventsPath = path.join(__dirname, 'data', 'events.json');
let eventsData = [];
if (fs.existsSync(eventsPath)) {
    try {
        eventsData = JSON.parse(fs.readFileSync(eventsPath, 'utf8'));
        console.log(`Loaded ${eventsData.length} events from ${eventsPath}`);
    } catch (err) {
        console.error("Error reading events.json:", err);
    }
} else {
    console.warn("Events data file not found:", eventsPath);
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

// Parse JSON bodies
app.use(express.json());

// Paths for data files
const rsvpsPath = path.join(__dirname, 'data', 'rsvps.json');
const sdcCoinsPath = path.join(__dirname, 'data', 'sdc_coins.json');

// Helper functions to read/write JSON files
function readJsonFile(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
        console.error(`Error reading ${filePath}:`, err);
        return null;
    }
}

function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (err) {
        console.error(`Error writing ${filePath}:`, err);
        return false;
    }
}

// API: Get RSVP status for an event
app.get('/api/rsvp/:eventId', (req, res) => {
    const rsvp = readJsonFile(rsvpsPath);
    if (rsvp && rsvp.eventId === req.params.eventId) {
        res.json({ hasRsvp: true, rsvp: rsvp });
    } else {
        res.json({ hasRsvp: false });
    }
});

// API: Save RSVP
app.post('/api/rsvp', (req, res) => {
    const { eventId, eventTitle, quantity } = req.body;

    // Save RSVP
    const rsvp = {
        eventId: eventId,
        eventTitle: eventTitle,
        quantity: quantity || 1,
        rsvpDate: new Date().toISOString()
    };

    if (!writeJsonFile(rsvpsPath, rsvp)) {
        return res.status(500).json({ error: 'Failed to save RSVP' });
    }

    // Add SDC coins
    let sdc = readJsonFile(sdcCoinsPath) || { claimable: 0, claims: [] };
    sdc.claimable += 20;
    sdc.claims.push({
        eventId: eventId,
        amount: 20,
        date: new Date().toISOString()
    });

    if (!writeJsonFile(sdcCoinsPath, sdc)) {
        return res.status(500).json({ error: 'Failed to update SDC coins' });
    }

    res.json({ success: true, rsvp: rsvp, sdcCoins: sdc.claimable });
});

// API: Cancel RSVP
app.delete('/api/rsvp/:eventId', (req, res) => {
    const rsvp = readJsonFile(rsvpsPath);

    if (!rsvp || rsvp.eventId !== req.params.eventId) {
        return res.status(404).json({ error: 'RSVP not found' });
    }

    // Clear RSVP
    const emptyRsvp = {
        eventId: null,
        eventTitle: null,
        quantity: 0,
        rsvpDate: null
    };

    if (!writeJsonFile(rsvpsPath, emptyRsvp)) {
        return res.status(500).json({ error: 'Failed to cancel RSVP' });
    }

    // Remove SDC coins for this event
    let sdc = readJsonFile(sdcCoinsPath) || { claimable: 0, claims: [] };
    const claimIndex = sdc.claims.findIndex(c => c.eventId === req.params.eventId);
    if (claimIndex !== -1) {
        sdc.claimable -= sdc.claims[claimIndex].amount;
        sdc.claims.splice(claimIndex, 1);
        writeJsonFile(sdcCoinsPath, sdc);
    }

    res.json({ success: true });
});

// API: Get SDC coins
app.get('/api/sdc', (req, res) => {
    const sdc = readJsonFile(sdcCoinsPath) || { claimable: 0, claims: [] };
    res.json(sdc);
});

// API: Claim SDC tokens (transfers tokens from deployer wallet to user)
app.post('/api/claim', async (req, res) => {
    const { walletAddress } = req.body;

    if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address required' });
    }

    // Validate wallet address
    if (!ethers.isAddress(walletAddress)) {
        return res.status(400).json({ error: 'Invalid wallet address' });
    }

    // Check if blockchain is initialized
    if (!sdcContract || !wallet) {
        return res.status(500).json({ error: 'Blockchain not configured. Check server .env file.' });
    }

    const sdc = readJsonFile(sdcCoinsPath) || { claimable: 0, claims: [] };

    if (sdc.claimable <= 0) {
        return res.status(400).json({ error: 'No tokens to claim' });
    }

    const amountToClaim = sdc.claimable;

    try {
        console.log(`Minting ${amountToClaim} SDC to ${walletAddress}...`);

        // Convert amount to wei (18 decimals)
        const amountWei = ethers.parseEther(amountToClaim.toString());

        // Mint new tokens directly to user's wallet
        const tx = await sdcContract.mint(walletAddress, amountWei);
        console.log(`Mint transaction submitted: ${tx.hash}`);

        // Wait for confirmation
        const receipt = await tx.wait();
        console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

        // Reset claimable balance after successful mint
        sdc.claimable = 0;
        sdc.claims = [];
        sdc.lastClaim = {
            walletAddress: walletAddress,
            amount: amountToClaim,
            txHash: tx.hash,
            date: new Date().toISOString()
        };

        writeJsonFile(sdcCoinsPath, sdc);

        res.json({
            success: true,
            amount: amountToClaim,
            txHash: tx.hash,
            blockNumber: receipt.blockNumber,
            message: `Successfully minted ${amountToClaim} SDC tokens!`
        });

    } catch (err) {
        console.error('Blockchain mint error:', err);
        res.status(500).json({
            error: err.reason || err.message || 'Failed to mint tokens',
            details: err.shortMessage || ''
        });
    }
});

// API: Get goodies catalog
app.get('/api/goodies', (req, res) => {
    const goodies = [
        { id: 'github-student', name: 'GitHub Student Developer Pack', cost: 50, category: 'Development' },
        { id: 'jetbrains-license', name: 'JetBrains IDE License', cost: 100, category: 'Development' },
        { id: 'coursera-course', name: 'Coursera Course Access', cost: 75, category: 'Learning' },
        { id: 'linkedin-premium', name: 'LinkedIn Learning Premium', cost: 80, category: 'Career' },
        { id: 'aws-credits', name: 'AWS Cloud Credits', cost: 60, category: 'Cloud' },
        { id: 'figma-pro', name: 'Figma Pro Subscription', cost: 90, category: 'Design' }
    ];
    res.json(goodies);
});

// Routes

app.get('/', (req, res) => {
    res.render('index');
});

// Wallet route
app.get('/wallet', (req, res) => {
    res.render('wallet');
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
app.get('/wallet.html', (req, res) => res.render('wallet'));
app.get('/events.html', (req, res) => res.render('events', { events: eventsData }));
app.get('/rsvp.html', (req, res) => {
    let eventId = req.query.id;
    let event;
    if (eventId) {
        event = eventsData.find(e => e.id == eventId);
    }

    // Fallback if no ID or ID not found: Use first event (or any valid one)
    if (!event && eventsData.length > 0) {
        event = eventsData[0]; // Default to first available event
    }

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

