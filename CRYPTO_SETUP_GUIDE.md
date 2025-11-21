# SDC to Polygon Amoy Crypto Conversion - Setup Guide

This guide will help you set up the backend service to send Polygon Amoy (MATIC) tokens to users who convert their SDC tokens.

## Overview

The system allows users to:
- Earn 10 SDC tokens every time they RSVP to an event
- Convert SDC tokens to Polygon Amoy MATIC at a rate of **1 SDC = 0.0001 MATIC**
- Receive MATIC directly to their MetaMask wallet on the Polygon Amoy Testnet

---

## Prerequisites

- Node.js installed (v16 or higher)
- A MetaMask wallet
- Basic understanding of blockchain and Ethereum wallets

---

## Step 1: Create a Service Wallet

The backend needs a wallet that will hold and distribute MATIC tokens to users. This is called the "service wallet."

### Option A: Create a New Wallet (Recommended for Production)

1. **Install MetaMask** (if not already installed)
   - Browser extension: https://metamask.io/download/
   - Or use the mobile app

2. **Create a New Account in MetaMask**
   - Open MetaMask
   - Click the account icon → "Create Account"
   - Name it "SunDevilSync Service Wallet"
   - **IMPORTANT**: This wallet will hold funds, so keep it secure!

3. **Export the Private Key**
   - Click the 3 dots next to the account
   - Select "Account Details"
   - Click "Show Private Key"
   - Enter your MetaMask password
   - **Copy the private key** (starts with `0x`)
   - ⚠️ **NEVER share this private key with anyone!**

### Option B: Use an Existing Wallet (For Testing Only)

If you already have a test wallet with some funds, you can use its private key.

---

## Step 2: Add Polygon Amoy Testnet to MetaMask

1. **Open MetaMask**

2. **Add the Network Manually:**
   - Click the network dropdown (usually shows "Ethereum Mainnet")
   - Click "Add Network" → "Add a network manually"
   - Enter these details:

   ```
   Network Name: Polygon Amoy Testnet
   RPC URL: https://rpc-amoy.polygon.technology/
   Chain ID: 80002
   Currency Symbol: MATIC
   Block Explorer URL: https://amoy.polygonscan.com/
   ```

3. **Click "Save"**

4. **Switch to Polygon Amoy Testnet** from the network dropdown

---

## Step 3: Get Test MATIC Tokens

Since this is a testnet, you can get free test MATIC from a faucet.

### Polygon Faucet Options:

1. **Official Polygon Faucet**
   - Visit: https://faucet.polygon.technology/
   - Select "Polygon Amoy"
   - Paste your service wallet address
   - Click "Submit"
   - Wait for the transaction to complete

2. **Alchemy Faucet** (Alternative)
   - Visit: https://www.alchemy.com/faucets/polygon-amoy
   - Sign in with Google/GitHub
   - Paste your service wallet address
   - Request MATIC

3. **QuickNode Faucet** (Alternative)
   - Visit: https://faucet.quicknode.com/polygon/amoy
   - Paste your service wallet address
   - Complete the captcha
   - Request MATIC

**Recommended Amount**: Get at least **1 MATIC** for testing. This allows:
- 10,000 SDC conversions at 0.0001 MATIC each
- Plus gas fees for transactions

---

## Step 4: Configure Environment Variables

1. **Navigate to your project directory:**
   ```bash
   cd /Users/chiru/Desktop/Blockchain-Project/SunDevilSyncUI
   ```

2. **Create a `.env` file** in the `SunDevilSyncUI` directory:
   ```bash
   touch .env
   ```

3. **Add your configuration** to the `.env` file:
   ```env
   # Service Wallet Private Key (from Step 1)
   SERVICE_WALLET_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE

   # Polygon Amoy RPC URL (default provided, but you can use your own)
   AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
   ```

   **Example `.env` file:**
   ```env
   SERVICE_WALLET_PRIVATE_KEY=0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
   AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
   ```

4. **Save the file**

⚠️ **SECURITY WARNING**:
- Never commit the `.env` file to git
- Never share your private key
- Add `.env` to your `.gitignore` file

---

## Step 5: Verify the Setup

1. **Start the server:**
   ```bash
   cd /Users/chiru/Desktop/Blockchain-Project/SunDevilSyncUI
   node server.js
   ```

2. **Check the console output** - you should see:
   - "Server running on http://localhost:3000"
   - No wallet-related errors

3. **Test the wallet service** by checking the balance:
   - Open the browser console
   - The service will automatically validate the wallet on startup

---

## Step 6: Test the Conversion Flow

1. **Login to SunDevilSync:**
   - Navigate to `http://localhost:3000/login.html`
   - Default credentials: `student` / `password123`

2. **RSVP to an event** to earn 10 SDC tokens:
   - Go to an event page
   - Click "RSVP Now"
   - You should see "RSVP successful! You earned 10 SDC tokens."

3. **Go to the Dashboard:**
   - Navigate to `http://localhost:3000/dashboard.html`
   - Your balance should show your SDC tokens

4. **Test the conversion:**
   - Click the "Get Crypto" → "Convert" button
   - Enter your MetaMask wallet address (can be different from service wallet)
   - Enter amount of SDC to convert (e.g., 10)
   - Click "Convert to Crypto"
   - Wait for the transaction to complete
   - Check the transaction on PolyGonscan!

---

## API Endpoints

The following endpoints are available:

### Get SDC Balance
```
GET /api/sdc-balance
Authentication: Required (session)
Response: { sdcTokens: number, walletAddress: string }
```

### Convert SDC to Amoy
```
POST /api/convert-to-amoy
Authentication: Required (session)
Body: { sdcAmount: number, walletAddress: string }
Response: {
  success: boolean,
  message: string,
  txHash: string,
  blockNumber: number,
  amoyAmount: string,
  sdcAmount: number,
  remainingSDC: number,
  explorerUrl: string
}
```

### Get Conversion History
```
GET /api/conversion-history
Authentication: Required (session)
Response: Array of conversion records
```

---

## Troubleshooting

### Error: "Wallet service not initialized"
- Check that `SERVICE_WALLET_PRIVATE_KEY` is set in `.env`
- Verify the private key starts with `0x`
- Restart the server after changing `.env`

### Error: "Insufficient service wallet balance"
- Check your service wallet balance in MetaMask
- Get more test MATIC from a faucet (Step 3)
- Each conversion requires: `(SDC amount × 0.0001) + gas fees`

### Error: "Invalid wallet address"
- Ensure the user's wallet address starts with `0x`
- Address must be exactly 42 characters long
- Check for typos or extra spaces

### Transaction Pending Forever
- Polygon Amoy testnet can be slow sometimes
- Check the transaction on https://amoy.polygonscan.com/
- If stuck for >5 minutes, there may be a network issue

### Gas Fees Too High
- Gas fees are minimal on Polygon Amoy testnet
- Typical fee: ~0.00001 MATIC per transaction
- If fees seem high, check that you're on the correct network

---

## Production Considerations

When moving to production (mainnet):

1. **Switch to Polygon Mainnet:**
   - Update RPC URL to: `https://polygon-rpc.com/`
   - Update Chain ID to: `137`
   - Update explorer URL to: `https://polygonscan.com/`

2. **Security:**
   - Use a hardware wallet for the service wallet
   - Implement rate limiting
   - Add multi-signature wallet support
   - Set up monitoring and alerts for the service wallet balance

3. **Funding:**
   - Purchase real MATIC tokens
   - Set up automatic balance monitoring
   - Implement alerts when balance is low

4. **Compliance:**
   - Ensure compliance with local regulations
   - Implement KYC if required
   - Add terms of service and user agreements

---

## Service Architecture

```
User RSVPs → +10 SDC tokens in database

User converts SDC to crypto:
1. Frontend sends request to /api/convert-to-amoy
2. Backend validates user balance and wallet address
3. Backend creates conversion record (status: processing)
4. Wallet service sends MATIC via blockchain
5. Transaction is confirmed on Polygon network
6. Backend updates conversion record (status: completed)
7. Backend deducts SDC from user's account
8. Frontend displays success with transaction hash
```

---

## Monitoring Service Wallet Balance

You can check your service wallet balance at any time:

1. **In MetaMask:**
   - Switch to the service wallet account
   - Switch to Polygon Amoy network
   - Balance displayed at the top

2. **On Block Explorer:**
   - Visit https://amoy.polygonscan.com/
   - Enter your service wallet address
   - View balance and transaction history

3. **Calculate remaining conversions:**
   ```
   Current Balance: 1.0 MATIC
   Per Conversion: 0.0001 MATIC
   Remaining Conversions: ~10,000 (minus gas fees)
   ```

---

## Support & Resources

- **Polygon Documentation**: https://docs.polygon.technology/
- **MetaMask Help**: https://support.metamask.io/
- **Ethers.js Documentation**: https://docs.ethers.org/
- **Polygon Amoy Faucet**: https://faucet.polygon.technology/
- **Polygon Amoy Explorer**: https://amoy.polygonscan.com/

---

## Next Steps

After completing the setup:

1. Test multiple conversions to ensure everything works
2. Monitor the service wallet balance
3. Set up alerts for low balance
4. Consider implementing additional features:
   - Email notifications for successful conversions
   - Conversion history page
   - Admin dashboard to monitor conversions
   - Support for other networks (Ethereum, BSC, etc.)

---

## Questions?

If you encounter any issues not covered in this guide, check:
- Server logs in the terminal
- Browser console for frontend errors
- Transaction status on Polygon Amoy explorer
- .env file configuration

Good luck with your SDC to crypto conversion system!
