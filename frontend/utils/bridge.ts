// Across Protocol v3 cross-chain bridge integration
// Docs: https://docs.across.to
// The spokePoolAddress is returned dynamically by the quote API — no hardcoding needed.

const ACROSS_API = "https://app.across.to/api";

// ─── Chain mappings ───────────────────────────────────────────────────────────

// Mainnet chain IDs
export const CHAIN_IDS = {
  ETHEREUM: 1,
  BASE: 8453,
  ARBITRUM: 42161,
  OPTIMISM: 10,
  POLYGON: 137,
  // Testnets
  SEPOLIA: 11155111,
  BASE_SEPOLIA: 84532,
  ARBITRUM_SEPOLIA: 421614,
} as const;

// Map testnet chain ID → mainnet equivalent (Across only supports mainnet)
const TESTNET_TO_MAINNET: Record<number, number> = {
  [CHAIN_IDS.BASE_SEPOLIA]: CHAIN_IDS.BASE,
  [CHAIN_IDS.ARBITRUM_SEPOLIA]: CHAIN_IDS.ARBITRUM,
  [CHAIN_IDS.SEPOLIA]: CHAIN_IDS.ETHEREUM,
};

export function isTestnet(chainId: number): boolean {
  return chainId in TESTNET_TO_MAINNET;
}

// For Across quotes, map testnet chain IDs to their mainnet equivalent
// (Across routes only exist on mainnet)
export function toMainnetChainId(chainId: number): number {
  return TESTNET_TO_MAINNET[chainId] ?? chainId;
}

// ─── USDC addresses ───────────────────────────────────────────────────────────

const USDC_ADDRESSES: Record<number, string> = {
  // Mainnet
  [CHAIN_IDS.ETHEREUM]: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  [CHAIN_IDS.BASE]: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  [CHAIN_IDS.ARBITRUM]: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  [CHAIN_IDS.OPTIMISM]: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  [CHAIN_IDS.POLYGON]: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  // Testnets
  [CHAIN_IDS.BASE_SEPOLIA]: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  [CHAIN_IDS.ARBITRUM_SEPOLIA]: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  [CHAIN_IDS.SEPOLIA]: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
};

export function getUSDCAddress(chainId: number): string | null {
  return USDC_ADDRESSES[chainId] ?? null;
}

// ─── Chain resolution ─────────────────────────────────────────────────────────

// Map the receiver's ENS preference string → chain ID
// Respects testnet context: if payer is on testnet, receiver chain is also testnet
export function resolveDestChainId(receiverNetwork: string, payerChainId: number): number {
  const n = receiverNetwork.toLowerCase();
  const onTestnet = isTestnet(payerChainId);

  if (n.includes("base")) return onTestnet ? CHAIN_IDS.BASE_SEPOLIA : CHAIN_IDS.BASE;
  if (n.includes("arbitrum")) return onTestnet ? CHAIN_IDS.ARBITRUM_SEPOLIA : CHAIN_IDS.ARBITRUM;
  if (n.includes("eth") || n.includes("ethereum") || n === "sepolia") return onTestnet ? CHAIN_IDS.SEPOLIA : CHAIN_IDS.ETHEREUM;
  if (n.includes("optimism") || n.includes("op")) return CHAIN_IDS.OPTIMISM;
  if (n.includes("polygon")) return CHAIN_IDS.POLYGON;

  return onTestnet ? CHAIN_IDS.BASE_SEPOLIA : CHAIN_IDS.BASE;
}

// ─── Across SpokePool ABI ─────────────────────────────────────────────────────

export const SPOKE_POOL_ABI = [
  {
    inputs: [
      { name: "depositor", type: "address" },
      { name: "recipient", type: "address" },
      { name: "inputToken", type: "address" },
      { name: "outputToken", type: "address" },
      { name: "inputAmount", type: "uint256" },
      { name: "outputAmount", type: "uint256" },
      { name: "destinationChainId", type: "uint256" },
      { name: "exclusiveRelayer", type: "address" },
      { name: "quoteTimestamp", type: "uint32" },
      { name: "fillDeadline", type: "uint32" },
      { name: "exclusivityDeadline", type: "uint32" },
      { name: "message", type: "bytes" },
    ],
    name: "depositV3",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// ─── Quote & bridge ───────────────────────────────────────────────────────────

export type AcrossQuote = {
  outputAmount: bigint;
  totalRelayFee: { pct: bigint; total: bigint };
  quoteTimestamp: number;
  fillDeadline: number;
  exclusivityDeadline: number;
  exclusiveRelayer: `0x${string}`;
  spokePoolAddress: `0x${string}`;
  originChainId: number;
  destinationChainId: number;
  inputToken: `0x${string}`;
  outputToken: `0x${string}`;
  estimatedFillTimeSec: number;
};

export type GetQuoteParams = {
  payerChainId: number;        // actual connected wallet chain
  receiverNetwork: string;     // from ENS preferences ("base", "arbitrum", etc.)
  amount: bigint;              // in USDC micro (6 decimals)
};

export type GetQuoteResult =
  | { ok: true; quote: AcrossQuote; isSameChain: false }
  | { ok: false; isSameChain: true }                   // same chain — use ENSPayRouter
  | { ok: false; isSameChain: false; error: string };  // cross-chain but unavailable

export async function getBridgeQuote(params: GetQuoteParams): Promise<GetQuoteResult> {
  const destChainId = resolveDestChainId(params.receiverNetwork, params.payerChainId);

  // Same chain — let caller use ENSPayRouter directly
  if (destChainId === params.payerChainId) {
    return { ok: false, isSameChain: true };
  }

  // Across only supports mainnet. Map testnet → mainnet for the quote.
  const originMainnet = toMainnetChainId(params.payerChainId);
  const destMainnet = toMainnetChainId(destChainId);

  const inputToken = getUSDCAddress(originMainnet);
  const outputToken = getUSDCAddress(destMainnet);

  if (!inputToken || !outputToken) {
    return {
      ok: false,
      isSameChain: false,
      error: `USDC not configured for chain ${originMainnet} or ${destMainnet}`,
    };
  }

  const url = new URL(`${ACROSS_API}/suggested-fees`);
  url.searchParams.set("inputToken", inputToken);
  url.searchParams.set("outputToken", outputToken);
  url.searchParams.set("originChainId", originMainnet.toString());
  url.searchParams.set("destinationChainId", destMainnet.toString());
  url.searchParams.set("amount", params.amount.toString());

  let data: {
    totalRelayFee: { pct: string; total: string };
    timestamp: string;
    fillDeadline: number;
    exclusivityDeadline: number;
    exclusiveRelayer: string;
    spokePoolAddress: string;
    outputAmount: string;
    estimatedFillTimeSec: number;
    outputToken: { address: string };
    inputToken: { address: string };
  };

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      const errText = await res.text();
      return {
        ok: false,
        isSameChain: false,
        error: `Across API: ${errText}`,
      };
    }
    data = await res.json();
  } catch {
    return {
      ok: false,
      isSameChain: false,
      error: "Failed to reach Across Protocol API. Check your connection.",
    };
  }

  // On testnets: the actual USDC addresses differ from mainnet ones used in the quote.
  // We substitute with the correct testnet addresses for the on-chain call.
  const actualInputToken = (getUSDCAddress(params.payerChainId) ?? inputToken) as `0x${string}`;
  const actualOutputToken = (getUSDCAddress(destChainId) ?? outputToken) as `0x${string}`;

  return {
    ok: true,
    isSameChain: false,
    quote: {
      outputAmount: BigInt(data.outputAmount),
      totalRelayFee: {
        pct: BigInt(data.totalRelayFee.pct),
        total: BigInt(data.totalRelayFee.total),
      },
      quoteTimestamp: parseInt(data.timestamp),
      fillDeadline: data.fillDeadline,
      exclusivityDeadline: data.exclusivityDeadline,
      exclusiveRelayer: data.exclusiveRelayer as `0x${string}`,
      spokePoolAddress: data.spokePoolAddress as `0x${string}`,
      originChainId: params.payerChainId,
      destinationChainId: destChainId,
      inputToken: actualInputToken,
      outputToken: actualOutputToken,
      estimatedFillTimeSec: data.estimatedFillTimeSec,
    },
  };
}
