const { ethers } = require('ethers');
require('dotenv').config();

class WalletService {
    constructor() {
        // Polygon Amoy Testnet RPC URL
        this.rpcUrl = process.env.AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology/';
        this.provider = new ethers.JsonRpcProvider(this.rpcUrl);

        // Private key for the service wallet (holds the Amoy tokens to distribute)
        this.privateKey = process.env.SERVICE_WALLET_PRIVATE_KEY;

        if (!this.privateKey) {
            console.warn('WARNING: SERVICE_WALLET_PRIVATE_KEY not set in environment variables');
        }

        this.wallet = this.privateKey ? new ethers.Wallet(this.privateKey, this.provider) : null;

        // Validate that the derived address matches the expected public key (if provided)
        if (this.wallet && process.env.SERVICE_WALLET_PUBLIC_KEY) {
            const expectedAddress = process.env.SERVICE_WALLET_PUBLIC_KEY.toLowerCase();
            const actualAddress = this.wallet.address.toLowerCase();

            if (actualAddress !== expectedAddress) {
                console.error('ERROR: Wallet address mismatch!');
                console.error(`Expected: ${expectedAddress}`);
                console.error(`Derived: ${actualAddress}`);
                console.error('Please verify your SERVICE_WALLET_PRIVATE_KEY and SERVICE_WALLET_PUBLIC_KEY in .env');
            } else {
                console.log(`✓ Service wallet initialized: ${this.wallet.address}`);
                console.log('  Users can send MATIC to this address to convert to SDC');
            }
        } else if (this.wallet) {
            console.log(`✓ Service wallet initialized: ${this.wallet.address}`);
            console.log('  Users can send MATIC to this address to convert to SDC');
        }
    }

    /**
     * Send Amoy tokens to a user's wallet address
     * @param {string} toAddress - Recipient wallet address
     * @param {number} sdcAmount - Amount of SDC tokens to convert
     * @returns {Promise<Object>} Transaction receipt with hash
     */
    async sendAmoy(toAddress, sdcAmount) {
        try {
            if (!this.wallet) {
                throw new Error('Wallet service not initialized. Please set SERVICE_WALLET_PRIVATE_KEY');
            }

            // Validate address
            if (!ethers.isAddress(toAddress)) {
                throw new Error('Invalid wallet address');
            }

            // Calculate Amoy amount: 0.0001 Amoy per SDC token
            const amoyPerSDC = '0.0001';
            const amoyAmount = (parseFloat(amoyPerSDC) * sdcAmount).toFixed(4);
            const amoyInWei = ethers.parseEther(amoyAmount);

            // Check service wallet balance
            const balance = await this.provider.getBalance(this.wallet.address);
            if (balance < amoyInWei) {
                throw new Error(`Insufficient service wallet balance. Required: ${amoyAmount} MATIC, Available: ${ethers.formatEther(balance)} MATIC`);
            }

            // Prepare transaction
            const tx = {
                to: toAddress,
                value: amoyInWei,
                // Let ethers estimate gas
            };

            // Send transaction
            console.log(`Sending ${amoyAmount} MATIC to ${toAddress}...`);
            const transaction = await this.wallet.sendTransaction(tx);

            console.log(`Transaction sent! Hash: ${transaction.hash}`);
            console.log('Waiting for confirmation...');

            // Wait for transaction to be mined
            const receipt = await transaction.wait();

            console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

            return {
                success: true,
                txHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                amoyAmount: amoyAmount,
                sdcAmount: sdcAmount,
                to: toAddress
            };

        } catch (error) {
            console.error('Error sending Amoy:', error);
            throw error;
        }
    }

    /**
     * Get service wallet balance
     * @returns {Promise<string>} Balance in MATIC
     */
    async getServiceWalletBalance() {
        try {
            if (!this.wallet) {
                throw new Error('Wallet service not initialized');
            }

            const balance = await this.provider.getBalance(this.wallet.address);
            return ethers.formatEther(balance);
        } catch (error) {
            console.error('Error getting wallet balance:', error);
            throw error;
        }
    }

    /**
     * Get service wallet address
     * @returns {string} Wallet address
     */
    getServiceWalletAddress() {
        return this.wallet ? this.wallet.address : null;
    }

    /**
     * Verify a transaction on the blockchain
     * @param {string} txHash - Transaction hash
     * @returns {Promise<Object>} Transaction details
     */
    async verifyTransaction(txHash) {
        try {
            const tx = await this.provider.getTransaction(txHash);
            if (!tx) {
                throw new Error('Transaction not found');
            }

            const receipt = await this.provider.getTransactionReceipt(txHash);

            return {
                exists: true,
                confirmed: receipt !== null,
                blockNumber: receipt?.blockNumber,
                status: receipt?.status === 1 ? 'success' : 'failed',
                from: tx.from,
                to: tx.to,
                value: ethers.formatEther(tx.value)
            };
        } catch (error) {
            console.error('Error verifying transaction:', error);
            throw error;
        }
    }
}

module.exports = new WalletService();
