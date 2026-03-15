# ENSPay

**Pay anyone with just their ENS name — no chain coordination, no token mismatch.**

ENSPay lets receivers publish their payment preferences (token, chain, DEX, slippage) as ENS text records. Payers only need to know the recipient's `.eth` name. ENSPay resolves the preferences and routes the payment automatically — same-chain swap, cross-chain bridge, or stealth one-time address.

---

## How It Works

```
Receiver sets preferences once          Payer enters ENS name
─────────────────────────────           ─────────────────────────────
alice.eth → enspay.token = USDC         1. Resolve alice.eth text records
           enspay.network = base        2. Detect payer chain
           enspay.dex = uniswap         3. Route: same-chain or bridge
           enspay.slippage = 0.5        4. Swap input token → USDC if needed
           enspay.stealth = true        5. Deliver to stealth or direct address
```

No coordination needed between sender and receiver. The ENS record is the contract.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                      │
│                                                                 │
│  /           Pay page — ENS resolve + smart routing            │
│  /setup      Receiver sets preferences on ENS text records     │
│  /profiles   View + edit all saved ENS profiles (MongoDB)      │
│  /receive    UPI-style QR terminal for receivers               │
│  /pay/[ens]  Shareable pay page per ENS name                   │
│  /dashboard  Transaction history + analytics                   │
└────────────────────┬────────────────────────────────────────────┘
                     │
         ┌───────────┴────────────┐
         │                        │
┌────────▼──────────┐   ┌────────▼──────────────────────────────┐
│  Ethereum Sepolia │   │  Base Sepolia                         │
│                   │   │                                       │
│  ENS Registry     │   │  ENSPayRouter.sol                     │
│  ENS Resolver     │   │   ├─ resolveAndPay()  → USDC transfer │
│  setText()        │   │   └─ resolveAndSwap() → Uniswap V3    │
│  getText()        │   │                                       │
└───────────────────┘   └───────────────────────────────────────┘
                     │
         ┌───────────┴────────────┐
         │                        │
┌────────▼──────────┐   ┌────────▼──────────┐
│  Across Protocol  │   │  MongoDB Atlas    │
│  (cross-chain     │   │  ens_profiles     │
│   bridging v3)    │   │  (off-chain cache)│
└───────────────────┘   └───────────────────┘
```

### Payment Routing Logic

```
payer submits ENS + amount + input token
         │
         ▼
   resolve ENS text records
         │
         ▼
   same chain as receiver? ──yes──► input === USDC? ──yes──► resolveAndPay()
         │                                           └──no───► resolveAndSwap()
         │
        no
         │
         ▼
   Across Protocol available? ──yes──► depositV3() on SpokePool
         │
        no
         │
         ▼
   show "cross-chain requires mainnet" error
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart contracts | Solidity 0.8.24, Hardhat |
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Wallet | wagmi v2, viem, RainbowKit |
| ENS | ENS Sepolia (Registry + PublicResolver) |
| DEX | Uniswap V3 `exactInputSingle` on Base Sepolia |
| Cross-chain | Across Protocol v3 (`depositV3`) |
| Stealth payments | One-time address generation via `/api/stealth-address` |
| Database | MongoDB Atlas (off-chain ENS profile cache) |
| QR scanning | BarcodeDetector API + EIP-681 URI parsing |

---

## Project Structure

```
enspay/
├── contracts/
│   └── ENSPayRouter.sol         # Pay + swap router on Base Sepolia
├── scripts/
│   └── deploy.js                # Hardhat deploy script
├── frontend/
│   ├── pages/
│   │   ├── index.tsx            # Pay page (UPI-style, QR scan, ENS input)
│   │   ├── setup.tsx            # Receiver preference setup
│   │   ├── profiles.tsx         # View + edit saved ENS profiles
│   │   ├── receive.tsx          # QR payment terminal for receivers
│   │   ├── dashboard.tsx        # Transaction analytics
│   │   ├── pay/[ens].tsx        # Shareable pay-by-ENS page
│   │   └── api/
│   │       ├── profile.ts       # CRUD for MongoDB ENS profiles
│   │       └── stealth-address.ts # One-time stealth address generation
│   ├── components/
│   │   └── Layout.tsx           # Nav + header shell
│   └── utils/
│       ├── ens.ts               # ENS text record resolution helpers
│       ├── contracts.ts         # ABI + deployed contract addresses
│       ├── bridge.ts            # Across Protocol v3 integration
│       ├── mongodb.ts           # MongoDB client + ENSProfile CRUD
│       ├── wagmi.ts             # Wagmi + RainbowKit config
│       └── stealthStore.ts      # Stealth commitment store
├── hardhat.config.js
└── package.json
```

---

## ENS Text Records

ENSPay reads and writes these keys on the ENS `PublicResolver`:

| Key | Values | Description |
|---|---|---|
| `enspay.token` | `USDC`, `USDT`, `DAI`, `WETH` | Preferred output token |
| `enspay.network` | `base`, `arbitrum`, `ethereum` | Preferred destination chain |
| `enspay.dex` | `uniswap`, `aerodrome`, `sushiswap` | Preferred DEX |
| `enspay.slippage` | `0.1` – `50` | Max slippage % |
| `enspay.note` | any string | Optional note shown to payers |
| `enspay.stealth` | `true` / `false` | Enable stealth (one-time) addresses |

All 6 records are written in a single `multicall()` transaction on Ethereum Sepolia.

---

## Smart Contract

**`ENSPayRouter.sol`** — deployed on Base Sepolia at `0xD07f07f038c202F8DEbc4345626466ef4AC93b99`

```solidity
// Direct USDC transfer
function resolveAndPay(address recipient, uint256 amount) external;

// Swap any ERC-20 → USDC via Uniswap V3, then transfer
function resolveAndSwap(
    address recipient,
    address inputToken,
    uint256 amountIn,
    uint256 amountOutMinimum
) external;
```

- Output token is always USDC (`0x036CbD53842c5426634e7929541eC2318f3dCF7e` on Base Sepolia)
- Swap uses Uniswap V3 `exactInputSingle` with 0.3% fee tier
- Default slippage: `DEFAULT_SLIPPAGE_BPS = 50` (0.5%)

---

## ENS Contracts (Sepolia)

| Contract | Address |
|---|---|
| ENS Registry | `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e` |
| Public Resolver | `0x8FADE66B79cC9f707aB26799354482EB93a5B7dD` |

---

## Local Setup

### Prerequisites

- Node.js 18+
- A WalletConnect Project ID (free at cloud.walletconnect.com)
- A MongoDB Atlas cluster URI

### 1. Clone and install

```bash
git clone https://github.com/your-username/enspay.git
cd enspay
npm install
cd frontend && npm install
```

### 2. Configure environment

Create `frontend/.env.local`:

```env
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/brobet

NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_BASE_SEPOLIA_RPC=
NEXT_PUBLIC_ETH_SEPOLIA_RPC=
NEXT_PUBLIC_BASE_SEPOLIA_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
NEXT_PUBLIC_ENSPAY_ROUTER_ADDRESS=0xD07f07f038c202F8DEbc4345626466ef4AC93b99
```

Create root `.env` for Hardhat:

```env
PRIVATE_KEY=
BASE_SEPOLIA_RPC_URL=
ETH_SEPOLIA_RPC_URL=
```

### 3. Run the frontend

```bash
cd frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Deploy contracts (optional — already deployed)

```bash
# From repo root
npm run compile
npm run deploy:base-sepolia
```

---

## Key Features

### Smart Payment Routing
The pay page resolves recipient preferences and picks the right route automatically. Same-chain USDC goes direct. Same-chain with a different token goes through a Uniswap V3 swap. Cross-chain payments use Across Protocol v3 `depositV3`.

### Stealth Payments
When a receiver enables stealth mode, each payer gets a unique one-time address. The payer's identity is never linked to the recipient on-chain. QR codes encode EIP-681 URIs pointing to the ephemeral address.

### QR Payment Terminal
The `/receive` page generates a QR code receivers can display. Static mode encodes a pay link; stealth mode encodes an EIP-681 `ethereum:` URI with a fresh one-time address. The pay page can scan these QR codes via the browser's native `BarcodeDetector` API.

### ENS Profiles Manager
The `/profiles` page loads all ENS names saved by the connected wallet from MongoDB. Each profile card shows current preferences and lets the receiver edit inline — saving both on-chain (ENS `multicall`) and to MongoDB simultaneously.

### Transaction Dashboard
The `/dashboard` page displays sent/received transaction history, daily volume charts, route mix breakdown (pay vs swap), and top recipient stats.

---

## API Routes

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/profile?ens=alice.eth` | Fetch single ENS profile |
| `GET` | `/api/profile?address=0x...` | Fetch all profiles for a wallet |
| `POST` | `/api/profile` | Create or update a profile |
| `DELETE` | `/api/profile?ens=alice.eth&address=0x...` | Delete a profile |
| `POST` | `/api/stealth-address` | Generate a one-time stealth address |

---

## Testnet Notes

- **ENS records**: Ethereum Sepolia
- **Payments / swaps**: Base Sepolia
- **Cross-chain bridging**: Across Protocol only supports mainnet chains. Testnet cross-chain payments show a clear error. On mainnet, bridging works transparently.
- All USDC addresses used are official Circle testnet deployments.
