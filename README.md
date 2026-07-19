# World Cup Oracle

World Cup Oracle is a decentralized, pay-per-view sports prediction marketplace designed for the modern Web3 fan experience. It solves a massive bottleneck in the current sports betting landscape: the data asymmetric divide where casual fans bet blind while professional data remains locked behind expensive monthly SaaS walls.

By introducing an innovative x402-inspired payment routing loop combined with an autonomous AI Sports Analyst Agent, World Cup Oracle lets users instantly unlock elite, institutional-grade tactical match previews using zero-friction cryptographic wallet signatures and micro-token transactions.


🚀 Live Links & Submissions
Live Web Application: worldcup-oracle-six.vercel.app

Backend Server Engine: worldcup-oracle-hh4w.onrender.com

Video Demo Walkthrough: [Link to your Loom Video]

🛠️ Injective Technology Integration
World Cup Oracle has been fundamentally architected around the core technical themes of the Injective Global Cup, utilizing decentralized primitives to handle payments, authorization, and analytical processing.

1. x402 Monitored Payments & Cryptographic Signatures
The core innovation of the application is a gas-optimized, signature-gated data delivery pipeline modeled directly on x402 monetization principles.

How it works: Instead of incurring heavy on-chain transaction fees for every single analytical lookup, the frontend packs the user’s identity, timestamp, and target matchId into a secure cryptographic envelope.

Backend Handshake: When the user signs the action, the payload is transmitted via custom, secure headers (PAYMENT-SIGNATURE, X-402-Payment-Required) to our Express 5 engine. The server uses ethers.js to cryptographically verify the address against the signature. If valid, the premium endpoint unlocks instantly.

2. Autonomous Sports Analytics Agent (Agent Skills)Once the payment signature is authorized, the system spins up an autonomous sports oracle agent built natively using the frontier Gemini 3.5 Flash production engine.The System Instruction Context: The agent acts as an elite football metrics analyst. It dynamically evaluates the target fixture data and generates contextual models mapping team form, expected goals ($xG$) profiles, set-piece variance, and tactical counter-press alignments.

Outcome Simulation: The agent converts static data into predictive insight, completing the fan loop by outputting a highly calculated, logically reasoned match preview.

## Architecture

[ Frontend: Next.js/Vercel ]
           │
           ▼ (Taps Unlock -> Prompts Wallet Signature)
[ Cryptographic Payment Envelope ]
           │
           ▼ (Sent via HTTP PAYMENT-SIGNATURE Header)
[ Backend Engine: Express 5 / Render ] 
           │
           ├──► [ Ethers.js Signature Verification ] ─── (Checks Signer Balance/Identity)
           │
           ▼ (Signature Authenticated)
[ Gemini 3.5 Flash Sports Agent ]
           │
           ▼ (Injects Tactical Prompt Framework & xG Metrics)
[ Premium Match Analysis Rendered to Fan ]

Summary Workflow 
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
💻 Core Project Structure
The project utilizes an ultra-clean, high-speed Native ES Modules configuration explicitly designed to eliminate cross-origin resource sharing (CORS) friction and runtime latencies:

server.js: The central nervous system of the oracle. Houses the preflight OPTIONS interceptors, the base64 header decoding logic, the crypto verification middleware, and the autonomous AI agent configurations.
In-Memory Match Matrix: An optimized data store that serves rapid free-tier engagement metrics (team titles, active betting pools) to drive fan retention before triggering the premium paywall loop.

Administrative Settle Controller: A fast-pass match resolution system (/api/admin/settle-match) protected by secure token handshakes allowing platform admins to dynamically push match scores and declare winning pools (home / away / draw).


## Setup

### 1. Prerequisites
- Node.js 18+
- A wallet (MetaMask) funded with Injective testnet INJ (for gas) — get some from the
  Injective testnet faucet
- A Gemini API key (for the AI analysis endpoint)
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

Follow the `TODO` comments at the top of `app/page.tsx` — mainly swapping the mock
match array for a contract read, and wiring wallet connect.


Developed with passion for the Injective Global Cup Hackathon 2026.
