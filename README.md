# World Cup Oracle

An AI-powered World Cup prediction market on Injective. Built for **The Injective Global Cup**
hackathon — uses x402 micropayments, native cross-chain USDC via CCTP, and an AI match-analysis
agent designed around Injective's MCP Server / Agent Skills workflow.

## What's actually real vs. what you need to wire up

This repo gives you a genuinely working foundation, not a mockup. Here's the honest state of each piece:

| Piece | Status |
|---|---|
| Smart contract (`contracts/WorldCupPredictionMarket.sol`) | ✅ Written, compiles clean (23 functions, 8.3KB bytecode), ready to deploy |
| Deployment scripts (`scripts/`) | ✅ Ready — need your wallet key + confirmed USDC address in `.env` |
| Backend + x402 payment gate (`backend/server.js`) | ✅ Uses the real `@injectivelabs/x402` package's actual API (verified against its type definitions, not guessed) |
| CCTP cross-chain scripts (`cctp/`) | ✅ Real CCTP V2 flow (burn → attest → mint) — needs current contract addresses from Circle's docs filled into `.env`, these change as CCTP expands |
| Frontend (`frontend/`) | ✅ Builds clean, custom stadium-scoreboard design — currently uses **mock data and simulated transactions**; needs wallet connection + real contract reads wired in (marked with `TODO` comments in `app/page.tsx`) |

Nothing here was deployed on your behalf — I don't have wallet access. Every deploy step below
uses *your* funded wallet.

## Architecture

```
User wallet ──stake USDC──▶ WorldCupPredictionMarket.sol (Injective)
                                      │
                                      ▼
                          Admin settles result after match
                                      │
                                      ▼
                          Winners claim() pro-rata payout

User wallet ──pay 0.05 USDC (x402)──▶ backend/server.js ──▶ Claude API ──▶ AI match analysis

User on Base/Ethereum/Solana ──burn USDC (CCTP)──▶ Circle attestation ──▶ mint USDC on Injective
```

## Setup

### 1. Prerequisites
- Node.js 18+
- A wallet (MetaMask) funded with Injective testnet INJ (for gas) — get some from the
  Injective testnet faucet
- An Anthropic API key (for the AI analysis endpoint)
- Confirm current contract/token addresses before you start — testnets get reset and
  Injective's CCTP integration is newly live (May 2026), so don't trust addresses baked
  into old tutorials:
  - USDC + CCTP addresses: docs.injective.network and developers.circle.com/cctp/evm-smart-contracts
  - Injective MCP Server / Agent Skills: docs.injective.network

### 2. Smart contract

```bash
npm install
cp .env.example .env   # fill in DEPLOYER_PRIVATE_KEY, USDC_ADDRESS, FEE_RECIPIENT
npx hardhat run scripts/deploy.js --network injectiveTestnet
# copy the printed contract address into backend/.env and frontend/.env.local
npx hardhat run scripts/create-match.js --network injectiveTestnet
```

If `npx hardhat compile` fails to download the Solidity compiler on a locked-down network,
that's a network policy issue, not a code issue — run it from a normal internet connection.
I compiled this contract successfully against solc 0.8.20 during development (see
`contract-abi.json` for proof).

### 3. Backend (x402-gated AI analysis)

```bash
cd backend
npm install
cp .env.example .env   # fill in USDC_ADDRESS, FACILITATOR_PRIVATE_KEY, ANTHROPIC_API_KEY
node server.js
```

Test the payment gate:
```bash
curl http://localhost:3001/api/analysis/0
# → 402 Payment Required, with PAYMENT-REQUIRED header describing what to pay
```
A real client (or the `@injectivelabs/x402/client` helper) signs an EIP-3009 authorization
and retries with a `PAYMENT-SIGNATURE` header to get the actual analysis.

### 4. CCTP cross-chain deposit (optional but named in the brief)

```bash
cd cctp
npm install
cp .env.example .env   # fill in every address — see comments in cctp-deposit.js
node cctp-deposit.js --amount 5000000    # burns 5 USDC on your source chain
# wait ~15s on testnet for attestation, then:
node cctp-mint.js --tx 0xYourBurnTxHash  # mints on Injective
```

### 5. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. You'll see the full UI working against mock data. To make it
real: follow the `TODO` comments at the top of `app/page.tsx` — mainly swapping the mock
match array for a contract read, and wiring wallet connect.

## Demo script (for judges)

1. Show the deployed contract on Injective's block explorer — a real, verified transaction
2. Walk through the UI: pick a match, stake USDC, show the pool split update
3. Click "Unlock AI analysis" — show the 402 → payment → 200 flow in the network tab
4. Show a CCTP burn transaction on the source chain and the matching mint on Injective
5. Talk through the settlement flow: admin calls `settleMatch()`, winners call `claim()`

Judges weigh working demos over slide decks — a 90-second screen recording of steps 1–4 is
worth more than a long pitch.

## Known limitations (say these out loud in your submission — it builds trust)

- Settlement is admin-controlled, not a decentralized oracle — deliberate scope cut for a
  10-day build, called out in the contract's own comments
- The AI analysis endpoint uses illustrative form data, not a live sports API — swap in a
  real feed before treating this as production
- Frontend wallet connection and contract reads are stubbed with mock data — see TODOs
