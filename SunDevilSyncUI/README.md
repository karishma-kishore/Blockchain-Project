# Sun Devil Central (Node/Express server)

Quick start:
- `npm install`
- Copy `.env.example` to `.env`, set `SESSION_SECRET`, decide `MOCK_CHAIN` (`true` for mock), and fill blockchain details if using a real chain (`AMOY_RPC_URL`, `BADGE_CONTRACT_ADDRESS`, `PRIVATE_KEY`, `SDC_TOKEN_ADDRESS`, `SERVICE_WALLET_PRIVATE_KEY`).
- `npm start` then open `http://localhost:3000`.

Test users (seeded):
- student / password123
- admin / adminpass123
- verifier / verifyme123

API mounts:
- Auth + core: `/api/...`
- Badges: `/api/badges/...`
- SDC token service: `/api/sdc/...`

Blockchain modes:
- Mock (default): no RPC or contracts required; badge/SDC flows return mock hashes.
- Real: set `MOCK_CHAIN=false`, supply RPC + contract addresses + keys. Use the Hardhat contracts in `../contracts` to deploy `SunDevilBadge` and `SDCToken`, then paste their addresses into `.env`.
