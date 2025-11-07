# SunDevilSync 2.0 – NFT Gamified Event Portal

![Architecture Diagram](./SunDevilSync%202.0%20Architecture.png)

## Project Description

SunDevilSync 2.0 is a blockchain-based event management platform that rewards students with verifiable NFT badges for participation in campus events. The system issues non-transferable achievement NFTs for attendance and credentials, while also enabling tradable collectible NFTs for referrals and special events.

### Key Features
- **Event Management**: Browse, enroll, and check-in to campus events
- **NFT Achievement Badges**: Blockchain-verified credentials on Polygon
- **Dual NFT System**: 
  - **AchievementSBT**: Non-transferable achievement NFTs (attendance, winner, volunteer badges)
  - **Collectible721**: Transferable collectible NFTs (referrals, limited editions)
- **Verification Portal**: Public verification for employers and faculty
- **Wallet Integration**: MetaMask and WalletConnect support
- **IPFS Metadata**: Decentralized metadata storage with privacy protection

### Technology Stack
- **Blockchain**: Polygon (Mumbai Testnet)
- **Smart Contracts**: Solidity 0.8.20, OpenZeppelin ERC-721
- **Development**: Hardhat
- **Backend**: Node.js, Express, MongoDB, Redis (planned)
- **Frontend**: React, TailwindCSS (planned)
- **IPFS**: Pinata for metadata storage (planned)

---

## Smart Contracts

### 1. AchievementSBT.sol
Non-transferable achievement NFT contract for credentials and participation badges.

**Key Features:**
- ERC-721 compliant with transfer restrictions
- EIP-712 permit-based minting for backend authorization
- Role-based access control (Admin, Minter, Pauser, Revoker)
- Token-level transfer locks (soulbound functionality)
- On-chain revocation system
- Batch minting for gas efficiency
- Pausable for emergency stops

**Main Functions:**
```solidity
function mintWithPermit(
    address to,
    bytes32 eventId,
    bytes32 badgeType,
    string metadataURI,
    uint256 deadline,
    bytes signature
) returns (uint256)

function mint(
    address to,
    bytes32 eventId,
    bytes32 badgeType,
    string metadataURI
) returns (uint256)

function batchMint(
    address[] recipients,
    bytes32[] eventIds,
    bytes32[] badgeTypes,
    string[] metadataURIs
)

function revoke(uint256 tokenId, string reason)

function setTransferLock(uint256 tokenId, bool locked)

function getTokenMetadata(uint256 tokenId) 
    returns (bytes32 eventId, bytes32 badgeType, uint256 issuedAt, 
             bool transferLock, bool isRevoked, string revocationReason)
```

### 2. Collectible721.sol
Fully transferable collectible NFT contract for trading and rewards.

**Key Features:**
- Standard ERC-721 with full transferability
- EIP-712 permit-based minting
- Scarcity controls (max supply per type)
- Series and serial number tracking
- Role-based access control
- Batch minting support

**Main Functions:**
```solidity
function mintWithPermit(
    address to,
    bytes32 collectibleType,
    string metadataURI,
    uint256 series,
    uint256 deadline,
    bytes signature
) returns (uint256)

function mint(
    address to,
    bytes32 collectibleType,
    string metadataURI,
    uint256 series
) returns (uint256)

function setMaxSupply(bytes32 collectibleType, uint256 maxSupply)

function getTokenMetadata(uint256 tokenId) 
    returns (bytes32 collectibleType, uint256 issuedAt, uint256 series,
             uint256 serialNumber, uint256 maxSupply, uint256 currentSupply)
```

---

## Dependencies

### Prerequisites
- Node.js v18 or higher
- npm or yarn package manager
- Git

### Smart Contract Development
```bash
- hardhat: ^2.19.0
- @openzeppelin/contracts: ^5.0.0
- @nomicfoundation/hardhat-toolbox: ^4.0.0
- ethers: ^6.9.0
- dotenv: ^16.3.1
```

### Testing Tools
- Hardhat Network (local blockchain)
- Chai (assertions)
- Hardhat coverage plugin

---

## Setup Instructions

### 1. Clone the Repository
```bash
git clone https://github.com/karishma-kishore/Blockchain-Project.git
cd Blockchain-project
```

### 2. Install Smart Contract Dependencies
```bash
cd contracts
npm install
```

### 3. Configure Environment
```bash
cp .env.example .env

# Edit .env with your configuration
# Required variables:
# - POLYGON_TESTNET_RPC: RPC URL for Polygon Mumbai testnet
# - DEPLOYER_PRIVATE_KEY: Private key for deployment wallet
# - POLYGONSCAN_API_KEY: API key for contract verification (optional)
# - BACKEND_MINTER_ADDRESS: Address that will have MINTER_ROLE
```

### 4. Compile Contracts
```bash
npm run compile
```

### 5. Run Tests
```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage
```

---

## Deployment

### Deploy to Local Hardhat Network
```bash
# Terminal 1: Start local node
npm run node

# Terminal 2: Deploy contracts
npm run deploy:local
```

### Deploy to Polygon Mumbai Testnet
```bash
# Ensure your deployer wallet has test MATIC
# Get free test MATIC from: https://faucet.polygon.technology/

npm run deploy:testnet
```

### Verify Contracts on PolygonScan
```bash
# After deployment, verify your contracts
npx hardhat verify --network polygon_testnet <CONTRACT_ADDRESS> "Constructor" "Arguments"

# Or use the automated verification script (after setting POLYGONSCAN_API_KEY)
npm run verify
```

### Deployment Output
After successful deployment, contract addresses will be saved in:
- `contracts/deployments/<network>-latest.json`
- Contract addresses are needed for backend configuration

---

## How to Use (Post-Deployment)

### 1. Grant Roles
```javascript
const contract = await ethers.getContractAt("AchievementSBT", contractAddress);

const MINTER_ROLE = await contract.MINTER_ROLE();
await contract.grantRole(MINTER_ROLE, backendMinterAddress);
```

### 2. Mint Achievement NFT (Direct)
```javascript
const eventId = ethers.id("event_hackathon_2025");
const badgeType = ethers.id("badge_attendance");
const metadataURI = "ipfs://QmXxxx...";
const recipientAddress = "0x...";

await achievementSBT.mint(recipientAddress, eventId, badgeType, metadataURI);
```

### 3. Mint with Permit (Backend Pattern)
```javascript
const signature = await signer.signTypedData(domain, types, value);

await achievementSBT.mintWithPermit(
  recipient,
  eventId,
  badgeType,
  metadataURI,
  deadline,
  signature
);
```

### 4. Query Token Metadata
```javascript
const metadata = await contract.getTokenMetadata(tokenId);
console.log(metadata);
// Returns: eventId, badgeType, issuedAt, transferLock, isRevoked, revocationReason
```
---

## Project Structure

```
Blockchain-project/
├── contracts/
│   ├── contracts/
│   │   ├── AchievementSBT.sol
│   │   └── Collectible721.sol
│   ├── test/
│   ├── scripts/
│   ├── hardhat.config.js
│   └── README.md
└── README.md / README2.md

```

---

## Testing

### Smart Contract Tests

The contracts include comprehensive test coverage:

```bash
cd contracts

# Run all tests
npm test

# Run with gas reporting
REPORT_GAS=true npm test

# Generate coverage report
npm run test:coverage
```

**Test Coverage Includes:**
- Role-based access control
- Minting (direct and permit-based)
- Batch operations
- Transfer locks and enforcement
- Revocation system
- Scarcity controls (collectibles)
- Pausability
- EIP-712 signature verification
- Edge cases and failure modes

### Expected Test Results
All 40+ tests should pass:
```
AchievementSBT
  ✓ Deployment tests
  ✓ Minting tests
  ✓ Transfer lock tests
  ✓ Revocation tests
  ✓ EIP-712 permit tests
  ✓ Pausability tests

Collectible721
  ✓ Deployment tests
  ✓ Minting tests
  ✓ Scarcity management tests
  ✓ Series tracking tests
  ✓ EIP-712 permit tests
```

---

## Security Features

### Implemented (Smart Contracts)
- **EIP-712 Signatures**: Backend-authorized minting prevents unauthorized token creation
- **Role-Based Access**: Granular permissions (Admin, Minter, Pauser, Revoker)
- **Transfer Locks**: Achievement NFTs are non-transferable (soulbound)
- **Reentrancy Guards**: Protection against reentrancy attacks
- **Pausability**: Emergency stop mechanism
- **Input Validation**: Require statements for all critical parameters
- **OpenZeppelin Standards**: Using audited, battle-tested libraries

---

## NFT Metadata Structure

NFT metadata follows OpenSea standard and is stored on IPFS:

```json
{
  "name": "ASU • Hackathon 2025 • Attendance",
  "description": "Verified on-chain proof of attendance.",
  "image": "ipfs://<CID>/badge.png",
  "external_url": "https://verify.sds.example/attest/<tokenId>",
  "attributes": [
    {"trait_type": "event_id", "value": "evt_8F3..."},
    {"trait_type": "event_name", "value": "ASU Hackathon"},
    {"trait_type": "badge_type", "value": "Attendance"},
    {"trait_type": "issued_at", "value": "2025-03-15T20:21:00Z"},
    {"trait_type": "issuer", "value": "SunDevilSync 2.0"},
    {"trait_type": "transferable", "value": "false"}
  ]
}
```

**Privacy**: No personally identifiable information (PII) is stored in public metadata or on-chain.

---

## Roadmap

### Phase 1: Smart Contracts (COMPLETED)
- [x] Design and implement AchievementSBT contract
- [x] Design and implement Collectible721 contract
- [x] Write comprehensive test suites
- [x] Deploy to local and testnet environments
- [x] Documentation

### Phase 2: Backend Development (IN PROGRESS)
- [ ] Implement authentication and wallet linking
- [ ] Build event management API
- [ ] Create check-in system with QR codes
- [ ] Implement IPFS metadata service
- [ ] Build async minting pipeline
- [ ] Set up queue workers

### Phase 3: Frontend Development (PLANNED)
- [ ] Implement wallet connection
- [ ] Build event browsing and enrollment UI
- [ ] Create badge gallery
- [ ] Build verification portal
- [ ] Implement admin dashboard

### Phase 4: Integration & Testing (PLANNED)
- [ ] End-to-end testing
- [ ] Security audit
- [ ] Performance optimization
- [ ] User acceptance testing

### Phase 5: Production Deployment (PLANNED)
- [ ] Deploy to Polygon mainnet
- [ ] Set up production infrastructure
- [ ] Monitoring and analytics
- [ ] Launch to ASU community

---

**Built with ❤️ for ASU students, by ASU students**

*Last Updated: November 2025*
