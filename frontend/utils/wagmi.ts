import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "viem";
import { arbitrum, arbitrumSepolia, baseSepolia, sepolia } from "wagmi/chains";

const appName = "ENSPay";
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "enspay-demo-project-id";

export const wagmiConfig = getDefaultConfig({
  appName,
  projectId,
  chains: [baseSepolia, sepolia, arbitrum, arbitrumSepolia],
  transports: {
    [baseSepolia.id]: http(
      process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || "https://sepolia.base.org"
    ),
    [sepolia.id]: http(
      process.env.NEXT_PUBLIC_ETH_SEPOLIA_RPC || "https://rpc.sepolia.org"
    ),
    [arbitrum.id]: http(process.env.NEXT_PUBLIC_ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc"),
    [arbitrumSepolia.id]: http(
      process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC || "https://sepolia-rollup.arbitrum.io/rpc"
    )
  },
  ssr: true
});
