import type { NextApiRequest, NextApiResponse } from "next";
import { JsonRpcProvider } from "ethers";
import { storeStealthMapping } from "@/utils/stealthStore";

type Data =
  | { stealthAddress: string }
  | { error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ensName = String(req.query.ens || "").trim();
  if (!ensName || !ensName.endsWith(".eth")) {
    return res.status(400).json({ error: "Missing or invalid ENS name" });
  }

  const accessToken = process.env.BITGO_ACCESS_TOKEN;
  const walletId = process.env.BITGO_WALLET_ID;
  const bitgoEnv = process.env.BITGO_ENV || "test";
  const bitgoCoin = process.env.BITGO_COIN || "teth";

  if (!accessToken || !walletId) {
    return res.status(500).json({ error: "BitGo credentials not configured" });
  }

  try {
    const ethSepoliaRpc = process.env.ETH_SEPOLIA_RPC_URL || process.env.NEXT_PUBLIC_ETH_SEPOLIA_RPC;
    const provider = new JsonRpcProvider(ethSepoliaRpc || "https://rpc.sepolia.org");
    const resolver = await provider.getResolver(ensName);
    const recipient = await resolver?.getAddress();

    if (!recipient) {
      return res.status(400).json({ error: "ENS address record not found" });
    }

    const bitgoPkg = await import("bitgo");
    const BitGo = (bitgoPkg as unknown as { BitGo: new (opts: { accessToken: string; env: string }) => any }).BitGo;
    const bitgo = new BitGo({ accessToken, env: bitgoEnv });
    const wallet = await bitgo.coin(bitgoCoin).wallets().get({ id: walletId });
    const createdAddress = await wallet.createAddress();
    const stealthAddress = createdAddress.address;

    if (!stealthAddress) {
      return res.status(500).json({ error: "Failed to generate stealth address from BitGo" });
    }

    storeStealthMapping(stealthAddress, recipient);
    return res.status(200).json({ stealthAddress });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown BitGo error";
    return res.status(500).json({ error: message });
  }
}
