# ENSPay

ENSPay lets senders pay or swap tokens to a recipient by entering only an ENS name.  
Preferences are stored on ENS Sepolia text records and execution happens on Base Sepolia.

## Stack

- Solidity + Hardhat (`/contracts`, `/scripts`)
- Next.js + Tailwind + wagmi + viem + RainbowKit (`/frontend`)
- ENS reads/writes on Ethereum Sepolia
- Payments/swaps on Base Sepolia

## Project Structure

```
/contracts
  ENSPayRouter.sol
/scripts
  deploy.js
/frontend
  /pages
    index.tsx
    setup.tsx
    dashboard.tsx
  /components
  /utils
    ens.ts
    contracts.ts
```

## Environment

Copy `.env.example` to `.env` and fill values:

```
PRIVATE_KEY=
BASE_SEPOLIA_RPC_URL=
ETH_SEPOLIA_RPC_URL=
BASE_SEPOLIA_USDC_ADDRESS=
BASE_SEPOLIA_SWAP_ROUTER02=0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4
NEXT_PUBLIC_BASE_SEPOLIA_RPC=
NEXT_PUBLIC_ETH_SEPOLIA_RPC=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_BASE_SEPOLIA_USDC=
NEXT_PUBLIC_ENSPAY_ROUTER_ADDRESS=
```

## ENS Contracts (Sepolia)

- ENSRegistry: `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e`
- PublicResolver: `0x8FADE66B79cC9f707aB26799354482EB93a5B7dD`

## Setup

1. Install root dependencies:
   ```bash
   npm install
   ```
2. Compile contracts:
   ```bash
   npm run compile
   ```
3. Deploy router on Base Sepolia:
   ```bash
   npm run deploy:base-sepolia
   ```
4. Put deployed router address into `NEXT_PUBLIC_ENSPAY_ROUTER_ADDRESS`.
5. Install frontend dependencies:
   ```bash
   cd frontend && npm install
   ```
6. Run frontend:
   ```bash
   npm run dev
   ```

## Quick Validation Commands

1. Validate deployed router (Base Sepolia):
   ```bash
   npm run validate:deployment
   ```
   Expected:
   - Bytecode present
   - `usdc()` = `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
   - `swapRouter02()` = `0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4`
   - `DEFAULT_SLIPPAGE_BPS()` = `50`

2. Validate ENS text records read (Sepolia):
   - Add this to `.env`:
     ```bash
     TEST_ENS_NAME=yourname.eth
     ```
   - Run:
     ```bash
     npm run read:ens
     ```
   Expected:
   - Resolved address is non-empty
   - `enspay.*` keys print expected values

## Contract Overview

`ENSPayRouter.sol` supports:

- `resolveAndPay(string ensName, address recipient, uint256 amount)`
- `resolveAndSwap(string ensName, address recipient, address inputToken, uint256 amountIn, uint256 amountOutMinimum)`

Notes:

- For the L1/L2 split (ENS on Sepolia, execution on Base Sepolia), ENS resolution is performed in frontend and recipient address is passed into the router call.
- USDC is the output token for both pay and swap routes.
- Swap uses Uniswap V3 `exactInputSingle` with 0.3% fee tier.
- Default slippage utility: `DEFAULT_SLIPPAGE_BPS = 50` (0.5%).

## Frontend Screens

1. `/setup`: Saves ENS text records using resolver `setText()` on Sepolia.
2. `/` (landing): Resolves ENS preferences and executes `Pay` or `Swap & Pay` on Base Sepolia.
3. `/dashboard`: Reads `PaymentRouted` and `SwapRouted` events and displays totals + last 5 routes.

## ENS Text Records Used

- `enspay.token`
- `enspay.network`
- `enspay.dex`
- `enspay.slippage`
- `enspay.note`

## Validation Checklist

1. `setText()` + `getText()` on ENS Sepolia:
   - Start frontend:
     ```bash
     cd frontend
     npm run dev
     ```
   - Open `http://localhost:3000/setup`
   - Connect wallet, switch to Sepolia, enter ENS, click `Save Preferences` (5 `setText()` txs).
   - Then verify in CLI:
     ```bash
     cd ..
     TEST_ENS_NAME=yourname.eth npm run read:ens
     ```
   - Or verify in UI at `http://localhost:3000/` using `Resolve Preferences`.
2. `resolveAndPay()` USDC transfer:
   - Ensure env has:
     - `NEXT_PUBLIC_ENSPAY_ROUTER_ADDRESS=0xD07f07f038c202F8DEbc4345626466ef4AC93b99`
     - `NEXT_PUBLIC_BASE_SEPOLIA_USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e`
   - Open `http://localhost:3000/`
   - Resolve recipient ENS
   - Enter amount (for example `1`)
   - Click `Pay` and approve USDC + router tx in wallet
   - Confirm recipient USDC increased on Base Sepolia explorer.
3. `resolveAndSwap()` Uniswap exact input single:
   - On `http://localhost:3000/`, set `Swap Input Token` to a Base Sepolia token with a USDC pool.
   - Click `Swap & Pay`
   - Confirm approval + swap tx in wallet
   - Verify in dashboard and explorer logs that `SwapRouted` emitted.
4. 3-screen functional flow:
   - `/setup`, `/`, `/dashboard` all connected to chain.
5. RainbowKit:
   - Wallet can connect and switch between Sepolia and Base Sepolia in-app.

## Important MVP Constraints

- ERC20 only (no native ETH route).
- USDC only as recipient output token.
- `amountOutMinimum` is provided from frontend based on ENS slippage preference.
