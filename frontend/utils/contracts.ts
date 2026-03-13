export const ENS_SEPOLIA_PUBLIC_RESOLVER = "0x8FADE66B79cC9f707aB26799354482EB93a5B7dD";
export const SWAP_ROUTER02_BASE_SEPOLIA = "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4";

export const ENSPAY_ROUTER_ADDRESS =
  process.env.NEXT_PUBLIC_ENSPAY_ROUTER_ADDRESS || "0x0000000000000000000000000000000000000000";
export const BASE_SEPOLIA_USDC =
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_USDC || "0x0000000000000000000000000000000000000000";

export const ERC20_ABI = [
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" }
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

export const ENSPAY_ROUTER_ABI = [
  {
    inputs: [
      { internalType: "string", name: "ensName", type: "string" },
      { internalType: "address", name: "recipient", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" }
    ],
    name: "resolveAndPay",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "string", name: "ensName", type: "string" },
      { internalType: "address", name: "recipient", type: "address" },
      { internalType: "address", name: "inputToken", type: "address" },
      { internalType: "uint256", name: "amountIn", type: "uint256" },
      { internalType: "uint256", name: "amountOutMinimum", type: "uint256" }
    ],
    name: "resolveAndSwap",
    outputs: [{ internalType: "uint256", name: "amountOut", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "sender", type: "address" },
      { indexed: true, internalType: "address", name: "recipient", type: "address" },
      { indexed: false, internalType: "string", name: "ensName", type: "string" },
      { indexed: false, internalType: "address", name: "token", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" }
    ],
    name: "PaymentRouted",
    type: "event"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "sender", type: "address" },
      { indexed: true, internalType: "address", name: "recipient", type: "address" },
      { indexed: false, internalType: "string", name: "ensName", type: "string" },
      { indexed: false, internalType: "address", name: "tokenIn", type: "address" },
      { indexed: false, internalType: "address", name: "tokenOut", type: "address" },
      { indexed: false, internalType: "uint256", name: "amountIn", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "amountOut", type: "uint256" }
    ],
    name: "SwapRouted",
    type: "event"
  }
] as const;

export const ENS_RESOLVER_ABI = [
  {
    inputs: [{ internalType: "bytes[]", name: "data", type: "bytes[]" }],
    name: "multicall",
    outputs: [{ internalType: "bytes[]", name: "results", type: "bytes[]" }],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { internalType: "bytes32", name: "node", type: "bytes32" },
      { internalType: "string", name: "key", type: "string" },
      { internalType: "string", name: "value", type: "string" }
    ],
    name: "setText",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
] as const;
