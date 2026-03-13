import { JsonRpcProvider } from "ethers";

export type ENSPayPreferences = {
  token: string;
  network: string;
  dex: string;
  slippage: string;
  note: string;
  address: string;
  isStealthy: boolean;
};

const FALLBACK_RPC = "https://rpc.sepolia.org";

function getSepoliaProvider() {
  return new JsonRpcProvider(process.env.NEXT_PUBLIC_ETH_SEPOLIA_RPC || FALLBACK_RPC);
}

export async function resolveENS(ensName: string): Promise<ENSPayPreferences> {
  const provider = getSepoliaProvider();
  const resolver = await provider.getResolver(ensName);

  if (!resolver) {
    throw new Error("No resolver found for ENS name.");
  }

  const [token, network, dex, slippage, note, stealth, address] = await Promise.all([
    resolver.getText("enspay.token"),
    resolver.getText("enspay.network"),
    resolver.getText("enspay.dex"),
    resolver.getText("enspay.slippage"),
    resolver.getText("enspay.note"),
    resolver.getText("enspay.stealth"),
    resolver.getAddress()
  ]);

  if (!address) {
    throw new Error("ENS name does not have an address record.");
  }

  if (stealth === "true") {
    const response = await fetch(`/api/stealth-address?ens=${encodeURIComponent(ensName)}`);
    if (!response.ok) {
      throw new Error("Failed to generate stealth address.");
    }

    const data = (await response.json()) as { stealthAddress?: string };
    if (!data.stealthAddress) {
      throw new Error("Stealth address not returned from backend.");
    }

    return {
      token: token || "USDC",
      network: network || "base",
      dex: dex || "uniswap",
      slippage: slippage || "0.5",
      note: note || "",
      address: data.stealthAddress,
      isStealthy: true
    };
  }

  return {
    token: token || "USDC",
    network: network || "base",
    dex: dex || "uniswap",
    slippage: slippage || "0.5",
    note: note || "",
    address,
    isStealthy: false
  };
}

export async function getENSPayPreferences(ensName: string): Promise<ENSPayPreferences> {
  return resolveENS(ensName);
}

export function getAmountOutMinimumFromSlippage(
  expectedOut: bigint,
  slippagePercent: string | undefined
): bigint {
  const parsed = Number(slippagePercent ?? "0.5");
  const bps = Math.max(0, Math.floor(parsed * 100));
  const cappedBps = Math.min(5000, bps);
  return (expectedOut * BigInt(10_000 - cappedBps)) / BigInt(10_000);
}
