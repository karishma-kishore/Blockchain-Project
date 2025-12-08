const { ethers } = require('ethers');
const sdcService = require('../services/sdcTokenService');

// Normalizes a human-readable balance string into a BigInt using the configured decimals.
function toBaseUnits(balanceStr, decimals) {
    try {
        return ethers.parseUnits(balanceStr || '0', decimals);
    } catch {
        return BigInt(0);
    }
}

async function getBalance(address) {
    const decimals = Number(process.env.SDC_DECIMALS || 18);
    const symbol = 'SDC';
    const mock = sdcService.usesMock();

    if (!address) {
        return { balance: BigInt(0), symbol, decimals, mock };
    }

    try {
        const bal = await sdcService.getBalance(address);
        // sdcService returns a formatted string; convert so callers can call toString().
        const balance = toBaseUnits(bal, decimals);
        return { balance, symbol, decimals, mock };
    } catch (err) {
        console.error('SDC getBalance failed:', err);
        return { balance: BigInt(0), symbol, decimals, mock, error: err.message };
    }
}

async function transfer(_from, to, amount) {
    const mock = sdcService.usesMock();
    const decimals = Number(process.env.SDC_DECIMALS || 18);
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        throw new Error('Amount must be greater than zero');
    }

    // In mock mode just fabricate a tx hash.
    if (mock) {
        return {
            hash: `0xmock_${Date.now()}`,
            network: 'mock',
            mock: true
        };
    }

    // Use the reward distributor as a stand-in for simple transfers.
    const res = await sdcService.distributeReward(to, numericAmount, 'TRANSFER', '');
    return {
        hash: res.txHash,
        network: res.mock ? 'mock' : 'amoy',
        mock: res.mock || false
    };
}

async function getNetworkLabel() {
    if (sdcService.usesMock()) {
        return 'mock';
    }
    try {
        const net = await sdcService.provider.getNetwork();
        return net.name && net.name !== 'unknown' ? net.name : `chain-${net.chainId}`;
    } catch {
        return 'unknown';
    }
}

function usesMock() {
    return sdcService.usesMock();
}

module.exports = {
    getBalance,
    transfer,
    getNetworkLabel,
    usesMock
};
