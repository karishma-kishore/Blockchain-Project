const { ethers } = require('ethers');
const badgeAbi = require('./SunDevilBadge.json');

const rpcUrl = process.env.AMOY_RPC_URL || process.env.POLYGON_RPC_URL;
const rawPrivateKey = process.env.PRIVATE_KEY || process.env.ISSUER_PRIVATE_KEY;
const contractAddress = process.env.BADGE_CONTRACT_ADDRESS;
const sdcTokenAddress = process.env.SDC_TOKEN_ADDRESS;
const mockEnabled = process.env.MOCK_CHAIN === 'true' || !rpcUrl || !contractAddress;

// SDC Token ABI (minimal interface for client operations)
const sdcTokenAbi = [
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function getUserStats(address) view returns (uint256 balance, uint256 rewards, uint256 count)",
    "function getSupplyStats() view returns (uint256 current, uint256 minted, uint256 burned, uint256 max)"
];

let provider;
let wallet;
let contract;
let sdcContract;
let cachedNetworkLabel;

const mockStore = new Map();
let mockCounter = 0;

function usesMock() {
    return mockEnabled;
}

function isConfigured() {
    return Boolean(rpcUrl && contractAddress && rawPrivateKey);
}

function getProvider() {
    if (!provider) {
        provider = new ethers.JsonRpcProvider(rpcUrl);
    }
    return provider;
}

function getWallet() {
    if (!wallet) {
        const normalizedKey = normalizePrivateKey(rawPrivateKey);
        if (!normalizedKey) {
            throw new Error('Private key not configured or invalid. Expect 0x-prefixed 64 hex characters in PRIVATE_KEY or ISSUER_PRIVATE_KEY.');
        }
        wallet = new ethers.Wallet(normalizedKey, getProvider());
    }
    return wallet;
}

function getContract(withSigner = false) {
    if (!contract) {
        const signerOrProvider = withSigner ? getWallet() : getProvider();
        contract = new ethers.Contract(contractAddress, badgeAbi, signerOrProvider);
    } else if (withSigner && !contract.signer) {
        contract = contract.connect(getWallet());
    }
    return contract;
}

async function getNetworkLabel() {
    if (cachedNetworkLabel) return cachedNetworkLabel;
    const net = await getProvider().getNetwork();
    cachedNetworkLabel = net.name && net.name !== 'unknown' ? net.name : `chain-${net.chainId}`;
    return cachedNetworkLabel;
}

async function issueBadge(params) {
    if (mockEnabled) {
        return mockIssueBadge(params);
    }
    if (!isConfigured()) {
        throw new Error('Blockchain not configured. Set AMOY_RPC_URL, BADGE_CONTRACT_ADDRESS, and PRIVATE_KEY.');
    }

    const { student, eventId, eventName, eventDate, achievementType, metadataURI } = params;
    const signer = getContract(true);

    const tx = await signer.issueBadge(student, eventId, eventName, eventDate, achievementType, metadataURI);
    const receipt = await tx.wait();
    const tokenId = await extractMintedTokenId(receipt);

    return {
        tokenId,
        transactionHash: receipt.hash,
        network: await getNetworkLabel()
    };
}

async function getBadge(tokenId) {
    if (mockEnabled) {
        return mockGetBadge(tokenId);
    }
    if (!contractAddress) {
        throw new Error('Contract address not configured');
    }

    const badgeContract = getContract(false);
    const badge = await badgeContract.getBadge(tokenId);
    const tokenURI = await badgeContract.tokenURI(tokenId);

    return normalizeBadge(tokenId, badge, tokenURI, await getNetworkLabel());
}

function normalizeBadge(tokenId, rawBadge, tokenURI, network) {
    // rawBadge can be an array-like object returned by ethers
    return {
        tokenId,
        eventId: Number(rawBadge.eventId ?? rawBadge[0]),
        eventName: rawBadge.eventName ?? rawBadge[1],
        eventDate: rawBadge.eventDate ?? rawBadge[2],
        achievementType: rawBadge.achievementType ?? rawBadge[3],
        metadataURI: rawBadge.metadataURI ?? rawBadge[4],
        issuedAt: Number(rawBadge.issuedAt ?? rawBadge[5]),
        issuer: rawBadge.issuer ?? rawBadge[6],
        tokenURI,
        network
    };
}

function normalizePrivateKey(value) {
    if (!value) return null;
    let key = value.trim().replace(/^['"]|['"]$/g, ''); // strip quotes
    if (!key.startsWith('0x') && key.length === 64) {
        key = `0x${key}`;
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
        return null;
    }
    return key;
}

async function mockIssueBadge(params) {
    mockCounter += 1;
    const tokenId = mockCounter;
    const now = Math.floor(Date.now() / 1000);
    const badge = {
        tokenId,
        eventId: params.eventId,
        eventName: params.eventName,
        eventDate: params.eventDate,
        achievementType: params.achievementType,
        metadataURI: params.metadataURI,
        issuedAt: now,
        issuer: '0xMockIssuer',
        tokenURI: params.metadataURI,
        network: 'mock'
    };
    mockStore.set(tokenId, badge);
    return {
        tokenId,
        transactionHash: `0xmock${tokenId}`,
        network: 'mock'
    };
}

async function mockGetBadge(tokenId) {
    if (!mockStore.has(tokenId)) {
        throw new Error('Badge not found (mock)');
    }
    return mockStore.get(tokenId);
}

// SDC Token Functions
function getSDCContract() {
    if (!sdcContract && sdcTokenAddress) {
        sdcContract = new ethers.Contract(sdcTokenAddress, sdcTokenAbi, getProvider());
    }
    return sdcContract;
}

function isSDCConfigured() {
    return Boolean(sdcTokenAddress && rpcUrl);
}

async function getSDCBalance(address) {
    if (mockEnabled || !isSDCConfigured()) {
        return '0';
    }
    const contract = getSDCContract();
    const balance = await contract.balanceOf(address);
    return ethers.formatEther(balance);
}

async function getSDCUserStats(address) {
    if (mockEnabled || !isSDCConfigured()) {
        return { balance: '0', rewards: '0', count: 0 };
    }
    const contract = getSDCContract();
    const stats = await contract.getUserStats(address);
    return {
        balance: ethers.formatEther(stats.balance),
        rewards: ethers.formatEther(stats.rewards),
        count: Number(stats.count)
    };
}

async function getSDCSupplyStats() {
    if (mockEnabled || !isSDCConfigured()) {
        return { current: '0', minted: '0', burned: '0', max: '0' };
    }
    const contract = getSDCContract();
    const stats = await contract.getSupplyStats();
    return {
        current: ethers.formatEther(stats.current),
        minted: ethers.formatEther(stats.minted),
        burned: ethers.formatEther(stats.burned),
        max: stats.max === BigInt(0) ? 'Unlimited' : ethers.formatEther(stats.max)
    };
}

async function extractMintedTokenId(receipt) {
    // Prefer decoding events to avoid an extra RPC call; fallback to totalMinted if needed.
    try {
        const iface = new ethers.Interface(badgeAbi);
        for (const log of receipt.logs) {
            try {
                const parsed = iface.parseLog(log);
                // ERC721 Transfer(address,address,uint256)
                if (parsed.name === 'Transfer') {
                    return Number(parsed.args.tokenId);
                }
                if (parsed.name === 'BadgeIssued') {
                    return Number(parsed.args.tokenId);
                }
            } catch {
                // ignore logs from other contracts
            }
        }
    } catch {
        // ignore and fallback
    }

    // Fallback to totalMinted call if events were not found
    const signer = getContract(true);
    const total = await signer.totalMinted();
    return Number(total);
}

module.exports = {
    issueBadge,
    getBadge,
    isConfigured,
    usesMock,
    // SDC Token exports
    isSDCConfigured,
    getSDCBalance,
    getSDCUserStats,
    getSDCSupplyStats,
    sdcTokenAddress
};
