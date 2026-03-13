import "@rainbow-me/rainbowkit/styles.css";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/utils/wagmi";
import GrainOverlay from "@/components/GrainOverlay";

const queryClient = new QueryClient();

export default function App({ Component, pageProps }: AppProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <Component {...pageProps} />
          <GrainOverlay />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
