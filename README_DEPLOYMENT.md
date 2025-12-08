# SunDevilSync 2.0 - Complete Deployment Guide

**TL;DR**: Deploy contracts → Copy addresses → Update `.env` files → Start server → Access web app

---

## 📋 Complete Steps (Copy & Paste)

### Step 1: Deploy Smart Contracts (5 minutes)

```bash
cd /Users/roystonf/Blockchain-Project/contracts
npm install
npm run compile
npm run deploy:amoy
```

**⚠️ IMPORTANT**: Save the contract addresses from the output!

```
SDCToken: 0x5d3d8d4b0D1022092e7DC3120A9798b2E58864fB
SunDevilBadge: 0xCc26F324F2e43F8dd1d95a25FB2DFe5659b80c34
AchievementSBT: 0xABC123...
Collectible721: 0xDEF456...
```

---

### Step 2: Update contracts/.env

Edit: `/Users/roystonf/Blockchain-Project/contracts/.env`

Replace these lines:
```env
BADGE_CONTRACT_ADDRESS=0xCc26F324F2e43F8dd1d95a25FB2DFe5659b80c34
SDC_TOKEN_ADDRESS=0x5d3d8d4b0D1022092e7DC3120A9798b2E58864fB
```

---

### Step 3: Update SunDevilSyncUI/.env

Edit: `/Users/roystonf/Blockchain-Project/SunDevilSyncUI/.env`

Replace these lines:
```env
BADGE_CONTRACT_ADDRESS=0xCc26F324F2e43F8dd1d95a25FB2DFe5659b80c34
SDC_TOKEN_ADDRESS=0x5d3d8d4b0D1022092e7DC3120A9798b2E58864fB
```

---

### Step 4: Start Backend Server (1 minute)

```bash
cd /Users/roystonf/Blockchain-Project/SunDevilSyncUI
npm install
npm start
```

You should see:
```
Server running on http://localhost:3000
```

---

### Step 5: Access the App

Open your browser:
```
http://localhost:3000
```

**You're Done!** 🎉

---

## 📚 Full Documentation

- **Detailed Guide**: See `DEPLOYMENT_GUIDE.md`
- **Quick Checklist**: See `QUICK_START.md`
- **Architecture**: See `ARCHITECTURE.md`
- **Environment Setup**: See `.env-sync-guide.md`

---

## 🆘 Troubleshooting

### "Cannot find module"
```bash
# Make sure you're in the right directory
cd /Users/roystonf/Blockchain-Project/SunDevilSyncUI
npm start
```

### "BADGE_CONTRACT_ADDRESS not configured"
- Re-run Step 1 (deployment)
- Copy addresses
- Update .env files (Steps 2-3)

### "MetaMask network error"
- Add Polygon Amoy network to MetaMask
- RPC: `https://rpc-amoy.polygon.technology/`
- ChainID: `80002`

### "Insufficient balance"
- Get MATIC tokens: https://faucet.polygon.technology/

---

## ✅ Checklist

- [ ] Node.js v18+ installed
- [ ] MetaMask wallet created
- [ ] Amoy test tokens obtained
- [ ] Deployed contracts (Step 1)
- [ ] Updated .env files (Steps 2-3)
- [ ] Server running (Step 4)
- [ ] Web app accessible (Step 5)

---

## 🚀 What's Next?

1. Register a test account
2. Link your MetaMask wallet
3. RSVP to an event
4. Test badge minting (admin)
5. Purchase from store

---

## 📞 Need Help?

1. Check `DEPLOYMENT_GUIDE.md` for detailed steps
2. Check `QUICK_START.md` for quick reference
3. Check `ARCHITECTURE.md` for system overview
4. Verify `.env` files are configured correctly
5. Ensure MetaMask is on Amoy testnet
