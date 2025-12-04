const { ethers } = require('ethers');
require('dotenv').config();

// SDCToken ABI - minimal interface for backend operations
const SDC_TOKEN_ABI = [
    // Read functions
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",

    // Reward constants
    "function RSVP_REWARD() view returns (uint256)",
    "function ATTENDANCE_REWARD() view returns (uint256)",
    "function REFERRAL_REWARD() view returns (uint256)",
    "function BADGE_EARNED_REWARD() view returns (uint256)",

    // Supply stats
    "function totalMinted() view returns (uint256)",
    "function totalBurned() view returns (uint256)",
    "function maxSupply() view returns (uint256)",
    "function remainingMintable() view returns (uint256)",

    // User stats
    "function totalRewardsEarned(address) view returns (uint256)",
    "function rewardCount(address) view returns (uint256)",
    "function getUserStats(address user) view returns (uint256 balance, uint256 rewards, uint256 count)",
    "function getSupplyStats() view returns (uint256 current, uint256 minted, uint256 burned, uint256 max)",

    // Write functions (require MINTER_ROLE)
    "function mint(address to, uint256 amount, string reason)",
    "function distributeReward(address recipient, uint256 amount, string rewardType, bytes32 referenceId)",
    "function batchDistributeReward(address[] recipients, uint256[] amounts, string rewardType, bytes32 referenceId)",

    // Transfer functions
    "function transfer(address to, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    "function approve(address spender, uint256 amount) returns (bool)",

    // Events
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event TokensMinted(address indexed to, uint256 amount, string reason, uint256 timestamp)",
    "event RewardDistributed(address indexed recipient, uint256 amount, string rewardType, bytes32 indexed referenceId, uint256 timestamp)"
];

class SDCTokenService {
    constructor() {
        this.rpcUrl = process.env.AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology/';
        this.provider = new ethers.JsonRpcProvider(this.rpcUrl);

        // Contract address - should be set after deployment
        this.contractAddress = process.env.SDC_TOKEN_ADDRESS;

        // Service wallet private key for minting/distributing
        this.privateKey = process.env.SERVICE_WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY;

        // Mock mode for testing without blockchain
        this.mockEnabled = process.env.MOCK_CHAIN === 'true' || !this.contractAddress;

        if (!this.privateKey && !this.mockEnabled) {
            console.warn('WARNING: SERVICE_WALLET_PRIVATE_KEY not set. SDC token operations will fail.');
        }

        this.wallet = this.privateKey ? new ethers.Wallet(this.normalizePrivateKey(this.privateKey), this.provider) : null;
        this.contract = null;

        // Mock storage for testing
        this.mockBalances = new Map();
        this.mockRewards = new Map();
    }

    normalizePrivateKey(value) {
        if (!value) return null;
        let key = value.trim().replace(/^['"]|['"]$/g, '');
        if (!key.startsWith('0x') && key.length === 64) {
            key = `0x${key}`;
        }
        return key;
    }

    getContract(withSigner = false) {
        if (!this.contractAddress) {
            throw new Error('SDC_TOKEN_ADDRESS not configured');
        }

        if (!this.contract) {
            const signerOrProvider = withSigner ? this.wallet : this.provider;
            this.contract = new ethers.Contract(this.contractAddress, SDC_TOKEN_ABI, signerOrProvider);
        } else if (withSigner && !this.contract.runner?.sendTransaction) {
            this.contract = this.contract.connect(this.wallet);
        }
        return this.contract;
    }

    isConfigured() {
        return Boolean(this.contractAddress && this.privateKey && this.rpcUrl);
    }

    usesMock() {
        return this.mockEnabled;
    }

    /**
     * Get token balance for an address
     * @param {string} address - Wallet address
     * @returns {Promise<string>} Balance in SDC tokens (formatted)
     */
    async getBalance(address) {
        if (this.mockEnabled) {
            const balance = this.mockBalances.get(address.toLowerCase()) || BigInt(0);
            return ethers.formatEther(balance);
        }

        const contract = this.getContract();
        const balance = await contract.balanceOf(address);
        return ethers.formatEther(balance);
    }

    /**
     * Get user statistics
     * @param {string} address - User wallet address
     * @returns {Promise<Object>} User stats including balance, rewards earned, reward count
     */
    async getUserStats(address) {
        if (this.mockEnabled) {
            const balance = this.mockBalances.get(address.toLowerCase()) || BigInt(0);
            const rewards = this.mockRewards.get(address.toLowerCase()) || { total: BigInt(0), count: 0 };
            return {
                balance: ethers.formatEther(balance),
                totalRewardsEarned: ethers.formatEther(rewards.total),
                rewardCount: rewards.count
            };
        }

        const contract = this.getContract();
        const stats = await contract.getUserStats(address);
        return {
            balance: ethers.formatEther(stats.balance),
            totalRewardsEarned: ethers.formatEther(stats.rewards),
            rewardCount: Number(stats.count)
        };
    }

    /**
     * Get token supply statistics
     * @returns {Promise<Object>} Supply stats
     */
    async getSupplyStats() {
        if (this.mockEnabled) {
            let totalSupply = BigInt(0);
            for (const balance of this.mockBalances.values()) {
                totalSupply += balance;
            }
            return {
                currentSupply: ethers.formatEther(totalSupply),
                totalMinted: ethers.formatEther(totalSupply),
                totalBurned: '0',
                maxSupply: 'Unlimited'
            };
        }

        const contract = this.getContract();
        const stats = await contract.getSupplyStats();
        return {
            currentSupply: ethers.formatEther(stats.current),
            totalMinted: ethers.formatEther(stats.minted),
            totalBurned: ethers.formatEther(stats.burned),
            maxSupply: stats.max === BigInt(0) ? 'Unlimited' : ethers.formatEther(stats.max)
        };
    }

    /**
     * Distribute reward tokens to a user
     * @param {string} recipient - Recipient wallet address
     * @param {number} amount - Amount in whole SDC tokens
     * @param {string} rewardType - Type of reward (RSVP, ATTENDANCE, REFERRAL, BADGE_EARNED)
     * @param {string} referenceId - Reference ID (e.g., event ID)
     * @returns {Promise<Object>} Transaction result
     */
    async distributeReward(recipient, amount, rewardType, referenceId = '') {
        if (this.mockEnabled) {
            return this.mockDistributeReward(recipient, amount, rewardType, referenceId);
        }

        if (!this.wallet) {
            throw new Error('Wallet not configured. Please set SERVICE_WALLET_PRIVATE_KEY');
        }

        if (!ethers.isAddress(recipient)) {
            throw new Error('Invalid recipient address');
        }

        const contract = this.getContract(true);
        const amountWei = ethers.parseEther(amount.toString());
        const refIdBytes = ethers.id(referenceId || `reward_${Date.now()}`);

        console.log(`Distributing ${amount} SDC to ${recipient} for ${rewardType}...`);

        const tx = await contract.distributeReward(recipient, amountWei, rewardType, refIdBytes);
        const receipt = await tx.wait();

        console.log(`Reward distributed! Tx: ${receipt.hash}`);

        return {
            success: true,
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            recipient,
            amount,
            rewardType,
            referenceId
        };
    }

    /**
     * Mint tokens to an address (admin function)
     * @param {string} to - Recipient address
     * @param {number} amount - Amount in whole SDC tokens
     * @param {string} reason - Reason for minting
     * @returns {Promise<Object>} Transaction result
     */
    async mint(to, amount, reason = 'Manual mint') {
        if (this.mockEnabled) {
            return this.mockMint(to, amount, reason);
        }

        if (!this.wallet) {
            throw new Error('Wallet not configured. Please set SERVICE_WALLET_PRIVATE_KEY');
        }

        if (!ethers.isAddress(to)) {
            throw new Error('Invalid recipient address');
        }

        const contract = this.getContract(true);
        const amountWei = ethers.parseEther(amount.toString());

        console.log(`Minting ${amount} SDC to ${to}...`);

        const tx = await contract.mint(to, amountWei, reason);
        const receipt = await tx.wait();

        console.log(`Tokens minted! Tx: ${receipt.hash}`);

        return {
            success: true,
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            to,
            amount,
            reason
        };
    }

    /**
     * Batch distribute rewards to multiple users
     * @param {Array<{address: string, amount: number}>} recipients - Array of recipients
     * @param {string} rewardType - Type of reward
     * @param {string} referenceId - Reference ID
     * @returns {Promise<Object>} Transaction result
     */
    async batchDistributeReward(recipients, rewardType, referenceId = '') {
        if (this.mockEnabled) {
            const results = [];
            for (const { address, amount } of recipients) {
                const result = await this.mockDistributeReward(address, amount, rewardType, referenceId);
                results.push(result);
            }
            return { success: true, results };
        }

        if (!this.wallet) {
            throw new Error('Wallet not configured. Please set SERVICE_WALLET_PRIVATE_KEY');
        }

        const contract = this.getContract(true);
        const addresses = recipients.map(r => r.address);
        const amounts = recipients.map(r => ethers.parseEther(r.amount.toString()));
        const refIdBytes = ethers.id(referenceId || `batch_reward_${Date.now()}`);

        console.log(`Batch distributing rewards to ${recipients.length} users...`);

        const tx = await contract.batchDistributeReward(addresses, amounts, rewardType, refIdBytes);
        const receipt = await tx.wait();

        console.log(`Batch rewards distributed! Tx: ${receipt.hash}`);

        return {
            success: true,
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber,
            recipientCount: recipients.length,
            rewardType,
            referenceId
        };
    }

    /**
     * Get the default reward amounts
     * @returns {Object} Reward amounts in SDC
     */
    getRewardAmounts() {
        return {
            RSVP: 10,
            ATTENDANCE: 20,
            REFERRAL: 5,
            BADGE_EARNED: 15
        };
    }

    /**
     * Get service wallet address
     * @returns {string|null} Wallet address
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
        if (this.mockEnabled) {
            return {
                exists: true,
                confirmed: true,
                status: 'success',
                mock: true
            };
        }

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
            to: tx.to
        };
    }

    // Mock implementations for testing
    mockDistributeReward(recipient, amount, rewardType, referenceId) {
        const addr = recipient.toLowerCase();
        const amountWei = ethers.parseEther(amount.toString());

        const currentBalance = this.mockBalances.get(addr) || BigInt(0);
        this.mockBalances.set(addr, currentBalance + amountWei);

        const currentRewards = this.mockRewards.get(addr) || { total: BigInt(0), count: 0 };
        this.mockRewards.set(addr, {
            total: currentRewards.total + amountWei,
            count: currentRewards.count + 1
        });

        return {
            success: true,
            txHash: `0xmock_${Date.now()}`,
            blockNumber: 0,
            recipient,
            amount,
            rewardType,
            referenceId,
            mock: true
        };
    }

    mockMint(to, amount, reason) {
        const addr = to.toLowerCase();
        const amountWei = ethers.parseEther(amount.toString());

        const currentBalance = this.mockBalances.get(addr) || BigInt(0);
        this.mockBalances.set(addr, currentBalance + amountWei);

        return {
            success: true,
            txHash: `0xmock_mint_${Date.now()}`,
            blockNumber: 0,
            to,
            amount,
            reason,
            mock: true
        };
    }
}

// Export singleton instance
module.exports = new SDCTokenService();
