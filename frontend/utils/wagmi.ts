import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "viem";
import { baseSepolia, sepolia } from "wagmi/chains";

const appName = "ENSPay";
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "enspay-demo-project-id";

export const wagmiConfig = getDefaultConfig({
  appName,
  projectId,
  chains: [baseSepolia, sepolia],
  transports: {
    [baseSepolia.id]: http(
      process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || "https://sepolia.base.org"
    ),
    [sepolia.id]: http(
      process.env.NEXT_PUBLIC_ETH_SEPOLIA_RPC || "https://rpc.sepolia.org"
    )
  },
  ssr: true
});
