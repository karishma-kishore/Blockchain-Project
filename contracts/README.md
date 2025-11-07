# SunDevilSync 2.0 - Smart Contracts

Smart contracts for the NFT Gamified Event Portal on Polygon blockchain.

## Overview

This directory contains the Solidity smart contracts for SunDevilSync 2.0, implementing:

- **AchievementSBT**: Non-transferable achievement NFTs (ERC-721 with transfer locks)
- **Collectible721**: Fully transferable collectible NFTs with scarcity controls

## Features

### AchievementSBT Contract
- ✅ ERC-721 compliant with transfer restrictions
- ✅ EIP-712 permit-based minting (backend authorization)
- ✅ Role-based access control (Admin, Minter, Pauser, Revoker)
- ✅ Token-level transfer locks
- ✅ Achievement revocation system
- ✅ Batch minting for gas efficiency
- ✅ On-chain metadata (event ID, badge type, timestamp)
- ✅ Pausable for emergency stops

### Collectible721 Contract
- ✅ Fully transferable ERC-721 tokens
- ✅ EIP-712 permit-based minting
- ✅ Scarcity controls (max supply per type)
- ✅ Series and serial number tracking
- ✅ Batch minting support
- ✅ Role-based access control

## Architecture

```
contracts/
├── contracts/
│   ├── AchievementSBT.sol      # Non-transferable achievement NFTs
│   └── Collectible721.sol      # Transferable collectible NFTs
├── scripts/
│   └── deploy.js               # Deployment script
├── test/
│   ├── AchievementSBT.test.js  # Comprehensive tests
│   └── Collectible721.test.js  # Comprehensive tests
├── hardhat.config.js           # Hardhat configuration
└── package.json                # Dependencies
```

## Setup

### Prerequisites
- Node.js v18+
- npm or yarn

### Installation

```bash
cd contracts
npm install
```

### Environment Configuration

Create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Network RPC URLs
POLYGON_TESTNET_RPC=https://rpc-mumbai.maticvigil.com
POLYGON_MAINNET_RPC=https://polygon-rpc.com

# Deployment
DEPLOYER_PRIVATE_KEY=your_private_key_here

# Verification
POLYGONSCAN_API_KEY=your_polygonscan_api_key

# Backend minter address (will be granted MINTER_ROLE)
BACKEND_MINTER_ADDRESS=0x0000000000000000000000000000000000000000
```

## Development

### Compile Contracts

```bash
npm run compile
```

### Run Tests

```bash
npm test
```

### Test Coverage

```bash
npm run test:coverage
```

### Lint Contracts

```bash
npm run lint
npm run lint:fix  # Auto-fix issues
```

### Local Development

Start a local Hardhat node:

```bash
npm run node
```

Deploy to local network (in another terminal):

```bash
npm run deploy:local
```

## Deployment

### Deploy to Polygon Testnet (Mumbai)

```bash
npm run deploy:testnet
```

### Verify Contracts

After deployment, verify on PolygonScan:

```bash
npm run verify
```

Or manually:

```bash
npx hardhat verify --network polygon_testnet <CONTRACT_ADDRESS> "Constructor" "Args"
```

## Contract Interaction

### Grant Roles

```javascript
// Grant MINTER_ROLE to backend service
const MINTER_ROLE = await contract.MINTER_ROLE();
await contract.grantRole(MINTER_ROLE, backendAddress);
```

### Mint Achievement (Direct)

```javascript
const eventId = ethers.id("event_hackathon_2025");
const badgeType = ethers.id("badge_attendance");
const metadataURI = "ipfs://QmXxxx...";

await achievementSBT.mint(
  recipientAddress,
  eventId,
  badgeType,
  metadataURI
);
```

### Mint with Permit (Backend)

```javascript
const domain = {
  name: "SunDevilSync Achievement",
  version: "1",
  chainId: chainId,
  verifyingContract: contractAddress
};

const types = {
  MintPermit: [
    { name: "to", type: "address" },
    { name: "eventId", type: "bytes32" },
    { name: "badgeType", type: "bytes32" },
    { name: "metadataURI", type: "string" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ]
};

const value = {
  to: recipientAddress,
  eventId: eventId,
  badgeType: badgeType,
  metadataURI: metadataURI,
  nonce: await contract.nonces(recipientAddress),
  deadline: deadline
};

const signature = await minterSigner.signTypedData(domain, types, value);

await contract.mintWithPermit(
  recipientAddress,
  eventId,
  badgeType,
  metadataURI,
  deadline,
  signature
);
```

### Set Max Supply (Collectibles)

```javascript
const collectibleType = ethers.id("collectible_limited_edition");
const maxSupply = 100;

await collectible721.setMaxSupply(collectibleType, maxSupply);
```

### Revoke Achievement

```javascript
const tokenId = 0;
const reason = "Fraudulent attendance";

await achievementSBT.revoke(tokenId, reason);
```

## Security Considerations

### Role Separation
- **DEFAULT_ADMIN_ROLE**: Deploy admin (multisig recommended)
- **MINTER_ROLE**: Backend service only (HSM/KMS protected)
- **PAUSER_ROLE**: Emergency responders
- **REVOKER_ROLE**: Compliance officers

### Best Practices
1. **Never share private keys** - Use hardware wallets or HSM for production
2. **Multisig admin** - Use Gnosis Safe for admin operations
3. **Test extensively** - Run full test suite before deployment
4. **Audit contracts** - Get professional audit before mainnet
5. **Monitor events** - Set up alerts for abnormal activity
6. **Gas optimization** - Use batch operations for large mints

### Transfer Lock Mechanism
- Achievement NFTs are **non-transferable by default**
- Admin can unlock specific tokens if needed
- Prevents credential fraud and maintains integrity

### EIP-712 Signatures
- Backend must sign all permit-based mints
- Prevents unauthorized minting
- Includes nonce to prevent replay attacks
- Has deadline for time-bound validity

## Gas Optimization

### Batch Operations
Use batch minting for events with many attendees:

```javascript
await achievementSBT.batchMint(
  [addr1, addr2, addr3],
  [eventId, eventId, eventId],
  [badgeType, badgeType, badgeType],
  [uri1, uri2, uri3]
);
```

### Expected Gas Costs (Polygon)
- Single mint: ~150k gas
- Batch mint (10 tokens): ~800k gas (~80k per token)
- Revocation: ~50k gas
- Set transfer lock: ~45k gas

## Troubleshooting

### Common Issues

**"AccessControl: account is missing role"**
- Ensure the signer has the required role
- Check role assignments with `hasRole()`

**"Token is non-transferable"**
- Achievement NFTs are locked by default
- Use `setTransferLock()` to unlock if needed

**"Max supply reached"**
- Increase max supply or use different collectible type
- Check current supply with `currentSupply()`

**"Permit expired"**
- Ensure deadline is in the future
- Regenerate signature with new deadline

## Testing

Test coverage includes:
- ✅ Role-based access control
- ✅ Minting (direct and permit-based)
- ✅ Batch operations
- ✅ Transfer locks and enforcement
- ✅ Revocation system
- ✅ Scarcity controls
- ✅ Pausability
- ✅ EIP-712 signature verification
- ✅ Edge cases and failure modes

Run tests:
```bash
npm test
```

## License

MIT

## Support

For issues or questions:
1. Check existing GitHub issues
2. Review test files for usage examples
3. Consult Hardhat documentation
4. Contact the development team
