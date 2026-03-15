<div align="center">

# ENSPay

**Receiver-controlled crypto payments via ENS — no chain coordination, no token mismatch.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity)](https://soliditylang.org)
[![wagmi](https://img.shields.io/badge/wagmi-v2-1C1C1E)](https://wagmi.sh)
[![Deployed on Base Sepolia](https://img.shields.io/badge/Base_Sepolia-deployed-0052FF?logo=coinbase)](https://sepolia.basescan.org/address/0xD07f07f038c202F8DEbc4345626466ef4AC93b99)

[Live Demo](#local-setup) · [Contract](#smart-contract) · [Architecture](#architecture) · [API Docs](#api-reference)

</div>

---

## The Problem

Sending crypto today requires the sender to know the recipient's:
- Wallet address (or ENS name)
- Preferred chain
- Preferred token
- Whether they want privacy

If any of those don't match, the sender has to coordinate with the receiver first. That's friction that doesn't exist in traditional payments like UPI or Venmo.

## The Solution

ENSPay turns an ENS name into a full payment specification. Receivers publish their preferences once as ENS text records. Payers just enter a `.eth` name — ENSPay handles the rest automatically.

```
Receiver (once)                        Payer (every time)
──────────────────────────────         ──────────────────────────────
alice.eth                              Enter: alice.eth + amount
  enspay.token   = USDC           →    Resolve preferences
  enspay.network = base                Auto-route: swap if needed
  enspay.dex     = uniswap             Bridge if cross-chain
  enspay.slippage = 0.5                Deliver to stealth address
  enspay.stealth = true                      ↓
                                       alice.eth receives USDC on Base
```

No coordination. No copy-pasting addresses. The ENS record is the payment contract.

---

## Features

| Feature | Description |
|---|---|
| **Smart Routing** | Same-chain direct transfer, same-chain token swap (Uniswap V3), or cross-chain bridge (Across Protocol v3) — picked automatically |
| **Stealth Payments** | Receiver enables one-time addresses; payer's identity is never on-chain linked to the recipient |
| **QR Payment Terminal** | UPI-style `/receive` page — generates a scannable QR that any payer can scan from the home screen |
| **QR Scanner** | Native `BarcodeDetector` API — no library overhead; parses URLs, bare ENS names, and EIP-681 `ethereum:` URIs |
| **ENS Profiles Manager** | View, edit, and delete all saved ENS preferences in one place, synced to MongoDB and on-chain simultaneously |
| **Shareable Pay Links** | `/pay/alice.eth` — a dedicated payment page for any ENS name, shareable as a link or QR |
| **Transaction Dashboard** | Volume charts, route breakdown (pay vs swap), top recipients |

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                          Frontend — Next.js 14                     │
│                                                                    │
│  /             Pay page (UPI-style, QR scan, ENS input)           │
│  /pay/[ens]    Shareable pay-by-ENS page                          │
│  /receive      QR payment terminal for receivers                  │
│  /setup        Receiver preference setup                          │
│  /profiles     View + edit all saved ENS profiles                 │
│  /dashboard    Transaction analytics                              │
└────────────┬──────────────────────────────────┬───────────────────┘
             │                                  │
             ▼                                  ▼
┌────────────────────┐              ┌───────────────────────────────┐
│  Ethereum Sepolia  │              │         Base Sepolia          │
│                    │              │                               │
│  ENS Registry      │              │  ENSPayRouter.sol             │
│  PublicResolver    │              │  ├─ resolveAndPay()           │
│  ├─ setText()      │              │  │    USDC transferFrom       │
│  └─ getText()      │              │  └─ resolveAndSwap()          │
│                    │              │       Uniswap V3 → USDC       │
└────────────────────┘              └───────────────────────────────┘
             │                                  │
             ▼                                  ▼
┌────────────────────┐              ┌───────────────────────────────┐
│  MongoDB Atlas     │              │  Across Protocol v3           │
│  ens_profiles      │              │  SpokePool.depositV3()        │
│  (off-chain cache) │              │  (mainnet cross-chain bridge) │
└────────────────────┘              └───────────────────────────────┘
```

### Payment Routing Decision Tree

```
  payer: ENS name + amount + input token
              │
              ▼
     resolve ENS text records
              │
              ▼
    same chain as receiver?
      │               │
     YES              NO
      │               │
      ▼               ▼
 input = USDC?   Across quote available?
   │       │        │              │
  YES      NO      YES             NO (testnet)
   │       │        │              │
   ▼       ▼        ▼              ▼
direct   Uniswap  depositV3()   show error
 xfer    V3 swap  on SpokePool
```

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Smart contracts | Solidity + Hardhat | `^0.8.24` |
| Frontend | Next.js + TypeScript + Tailwind CSS | `14` / `^5.6` / `^3.4` |
| Web3 client | wagmi + viem | `^2.12` / `^2.21` |
| Wallet UI | RainbowKit | latest |
| ENS | ENS Sepolia (Registry + PublicResolver) | — |
| DEX | Uniswap V3 `exactInputSingle` | 0.3% fee tier |
| Cross-chain bridge | Across Protocol v3 `depositV3` | — |
| QR codes | qrcode.react `QRCodeSVG` | `4.2.0` |
| QR scanning | Native `BarcodeDetector` API | — |
| Database | MongoDB Atlas | `7.1.0` |

---

## Project Structure

```
enspay/
├── contracts/
│   └── ENSPayRouter.sol          # USDC transfer + Uniswap V3 swap router
│
├── scripts/
│   ├── deploy.js                 # Hardhat deploy to Base Sepolia
│   ├── validateDeployment.js     # Smoke-test deployed contract
│   └── readEns.js                # Read enspay.* text records from CLI
│
├── frontend/
│   ├── pages/
│   │   ├── index.tsx             # Home — QR scanner, ENS input, quick actions
│   │   ├── pay/[ens].tsx         # /pay/alice.eth — shareable payment page
│   │   ├── receive.tsx           # Receiver QR terminal
│   │   ├── setup.tsx             # Save ENS preferences on-chain + MongoDB
│   │   ├── profiles.tsx          # Manage all saved profiles
│   │   ├── dashboard.tsx         # Transaction history + analytics
│   │   └── api/
│   │       ├── profile.ts        # REST: CRUD for MongoDB ENS profiles
│   │       └── stealth-address.ts # REST: generate one-time stealth address
│   │
│   ├── components/
│   │   └── Layout.tsx            # Global header, nav, wallet button
│   │
│   └── utils/
│       ├── ens.ts                # ENS text record read/write helpers
│       ├── contracts.ts          # ABIs + deployed addresses
│       ├── bridge.ts             # Across Protocol v3 quote + depositV3
│       ├── mongodb.ts            # MongoClient singleton + ENSProfile CRUD
│       ├── stealthStore.ts       # In-memory stealth address ↔ recipient map
│       └── wagmi.ts              # Wagmi + RainbowKit chain config
│
├── hardhat.config.js
├── package.json                  # Contracts workspace
└── frontend/package.json         # Frontend workspace
```

---

## ENS Text Records

ENSPay reads and writes six keys on the ENS `PublicResolver` (Ethereum Sepolia). All six are set atomically in a single `multicall()` transaction.

| Key | Example Value | Options | Description |
|---|---|---|---|
| `enspay.token` | `USDC` | `USDC`, `USDT`, `DAI`, `WETH` | Preferred output token |
| `enspay.network` | `base` | `base`, `arbitrum`, `ethereum` | Preferred destination chain |
| `enspay.dex` | `uniswap` | `uniswap`, `aerodrome`, `sushiswap` | Preferred DEX hint |
| `enspay.slippage` | `0.5` | `0.1` – `50` | Max acceptable slippage (%) |
| `enspay.note` | `For coffee ☕` | any string | Optional note shown to payers |
| `enspay.stealth` | `true` | `true`, `false` | Enable one-time stealth addresses |

---

## Smart Contract

**`ENSPayRouter.sol`** — [view on Base Sepolia](https://sepolia.basescan.org/address/0xD07f07f038c202F8DEbc4345626466ef4AC93b99)

```
Address:       0xD07f07f038c202F8DEbc4345626466ef4AC93b99
Network:       Base Sepolia (chain ID 84532)
USDC:          0x036CbD53842c5426634e7929541eC2318f3dCF7e
SwapRouter02:  0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4
```

### Interface

```solidity
/// @notice Transfer USDC directly from payer to recipient.
/// @dev    Requires prior ERC-20 approval of `amount` to this contract.
function resolveAndPay(
    string calldata ensName,
    address recipient,
    uint256 amount
) external;

/// @notice Swap `inputToken` → USDC via Uniswap V3 exactInputSingle, deliver to recipient.
/// @dev    Requires prior ERC-20 approval of `amountIn` to this contract.
function resolveAndSwap(
    string calldata ensName,
    address recipient,
    address inputToken,
    uint256 amountIn,
    uint256 amountOutMinimum
) external returns (uint256 amountOut);

/// @notice Apply default 0.5% slippage to a quoted output amount.
function applyDefaultSlippage(uint256 quotedOut) external pure returns (uint256);
```

### Events

```solidity
event PaymentRouted(
    address indexed sender,
    address indexed recipient,
    string ensName,
    address token,
    uint256 amount
);

event SwapRouted(
    address indexed sender,
    address indexed recipient,
    string ensName,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 amountOut
);
```

### Constants

| Constant | Value | Meaning |
|---|---|---|
| `DEFAULT_SLIPPAGE_BPS` | `50` | 0.5% default slippage |
| `UNISWAP_POOL_FEE` | `3000` | 0.3% Uniswap V3 fee tier |
| `BPS_DENOMINATOR` | `10_000` | Basis points denominator |

---

## ENS Contracts — Ethereum Sepolia

| Contract | Address |
|---|---|
| ENS Registry | [`0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e`](https://sepolia.etherscan.io/address/0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e) |
| Public Resolver | [`0x8FADE66B79cC9f707aB26799354482EB93a5B7dD`](https://sepolia.etherscan.io/address/0x8FADE66B79cC9f707aB26799354482EB93a5B7dD) |

---

## Local Setup

### Prerequisites

- **Node.js** ≥ 18
- **WalletConnect Project ID** — [cloud.walletconnect.com](https://cloud.walletconnect.com) (free)
- **MongoDB Atlas URI** — [mongodb.com/atlas](https://www.mongodb.com/atlas) (free tier works)
- An ETH Sepolia wallet with testnet funds ([faucet](https://sepoliafaucet.com)) and Base Sepolia USDC ([faucet](https://faucet.circle.com))

### 1 — Clone & install

```bash
git clone https://github.com/CodeswithrohStudio/enspay.git
cd enspay

# Contract workspace
npm install

# Frontend workspace
cd frontend && npm install
```

### 2 — Configure environment variables

**`frontend/.env.local`** (frontend + API routes):

```env
# MongoDB — off-chain profile cache
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/brobet

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# RPC endpoints
NEXT_PUBLIC_BASE_SEPOLIA_RPC=https://sepolia.base.org
NEXT_PUBLIC_ETH_SEPOLIA_RPC=https://rpc.sepolia.org

# Deployed contract addresses (already live — no deploy needed)
NEXT_PUBLIC_BASE_SEPOLIA_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
NEXT_PUBLIC_ENSPAY_ROUTER_ADDRESS=0xD07f07f038c202F8DEbc4345626466ef4AC93b99
```

**`.env`** (Hardhat — only needed if redeploying contracts):

```env
PRIVATE_KEY=0x...
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
ETH_SEPOLIA_RPC_URL=https://rpc.sepolia.org
```

### 3 — Run the frontend

```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4 — Deploy contracts _(optional — contract is already live)_

```bash
# From repo root
npm run compile
npm run deploy:base-sepolia
```

After deploy, update `NEXT_PUBLIC_ENSPAY_ROUTER_ADDRESS` in `frontend/.env.local`.

### 5 — Validate the deployment

```bash
# Smoke-test the live contract
npm run validate:deployment

# Read ENS text records for any name
TEST_ENS_NAME=yourname.eth npm run read:ens
```

---

## User Flows

### Receiver: set preferences

1. Go to `/setup`
2. Connect wallet on **Ethereum Sepolia**
3. Enter your ENS name (e.g. `yourname.eth`)
4. Choose token, network, DEX, slippage, note, stealth toggle
5. Click **Save Preferences** → single `multicall()` tx on Sepolia
6. Preferences are also cached to MongoDB for instant reads

### Payer: send a payment

1. Go to `/` (home)
2. Type a `.eth` name **or** tap **Scan QR** to scan the receiver's QR code
3. Enter amount and your input token
4. ENSPay resolves preferences and shows the route (direct / swap / bridge)
5. Click **Pay** → approve ERC-20 + confirm transaction
6. Receiver gets USDC on their preferred chain

### Receiver: generate a payment QR

1. Go to `/receive`
2. ENSPay detects your stealth preference automatically
3. **Static mode** — QR encodes `/?ens=yourname.eth` (reusable)
4. **Stealth mode** — QR encodes a fresh EIP-681 one-time address (single use)
5. Display the QR; payer scans and pays

### Receiver: manage profiles

1. Go to `/profiles`
2. See all ENS names registered from your wallet
3. Click **Edit** on any card → change any preference inline
4. Changes are saved on-chain + to MongoDB in one action

---

## API Reference

All routes are Next.js API routes under `frontend/pages/api/`.

### `GET /api/profile`

| Parameter | Required | Description |
|---|---|---|
| `ens` | one of | Fetch a single profile by ENS name |
| `address` | one of | Fetch all profiles owned by a wallet address |

**Response (single):**
```json
{
  "ensName": "alice.eth",
  "ownerAddress": "0x...",
  "token": "USDC",
  "network": "base",
  "dex": "uniswap",
  "slippage": "0.5",
  "note": "For coffee",
  "stealth": true,
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

### `POST /api/profile`

Upserts a profile. `ensName` and `ownerAddress` are required.

```json
{
  "ensName": "alice.eth",
  "ownerAddress": "0x...",
  "token": "USDC",
  "network": "base",
  "dex": "uniswap",
  "slippage": "0.5",
  "note": "",
  "stealth": false
}
```

### `DELETE /api/profile`

| Parameter | Required | Description |
|---|---|---|
| `ens` | ✓ | ENS name to delete |
| `address` | ✓ | Owner address (auth check) |

### `POST /api/stealth-address`

Generate a one-time stealth address for the given ENS name.

**Request:**
```json
{ "ensName": "alice.eth" }
```

**Response:**
```json
{
  "stealthAddress": "0x...",
  "eip681": "ethereum:0x...@84532/transfer?address=0x036CbD...&uint256=1000000"
}
```

---

## Stealth Payment Design

When `enspay.stealth = true` on a receiver's ENS:

1. Payer calls `POST /api/stealth-address` with the receiver's ENS name
2. API generates a fresh one-time address
3. An in-memory map `stealthAddress → recipientAddress` is kept server-side
4. The EIP-681 URI sent in the QR encodes the stealth address as the transfer target
5. The payer's wallet sends USDC to the stealth address
6. Only the server can link the stealth address back to the recipient

No identity is ever published on-chain. The payer sees only a one-time address.

> **Note:** The current stealth store is in-memory (`stealthStore.ts`). For production, persist the mapping to an encrypted database.

---

## Cross-Chain Routing

Cross-chain payments use [Across Protocol v3](https://docs.across.to):

1. `getBridgeQuote()` calls `app.across.to/api/suggested-fees` with payer chain, destination chain, token, and amount
2. The API returns a `spokePoolAddress` dynamically — no hardcoded SpokePool addresses
3. The frontend calls `SpokePool.depositV3()` on the payer's chain
4. Across relayers deliver USDC to the receiver on the destination chain

**Testnet limitation:** Across Protocol only supports mainnet chains. On testnets, cross-chain attempts show a descriptive error. The chain mapping and quote logic are fully wired for mainnet.

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit with conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`
4. Open a pull request against `main`

Please keep PRs focused — one feature or fix per PR.

---

## License

MIT © [CodeswithrohStudio](https://github.com/CodeswithrohStudio)
