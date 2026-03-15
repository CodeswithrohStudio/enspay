import type { NextApiRequest, NextApiResponse } from "next";
import {
  upsertProfile,
  getProfileByENS,
  getProfilesByAddress,
  deleteProfile,
  type ENSProfile,
} from "@/utils/mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // GET /api/profile?ens=alice.eth
    // GET /api/profile?address=0x...
    if (req.method === "GET") {
      const { ens, address } = req.query;

      if (typeof ens === "string" && ens) {
        const profile = await getProfileByENS(ens);
        if (!profile) return res.status(404).json({ error: "Profile not found" });
        return res.status(200).json({ profile: sanitize(profile) });
      }

      if (typeof address === "string" && address) {
        const profiles = await getProfilesByAddress(address);
        return res.status(200).json({ profiles: profiles.map(sanitize) });
      }

      return res.status(400).json({ error: "Missing ?ens= or ?address= parameter" });
    }

    // POST /api/profile — create or update
    if (req.method === "POST") {
      const { ensName, ownerAddress, token, network, dex, slippage, note, stealth } =
        req.body as Partial<ENSProfile>;

      if (!ensName || !ownerAddress) {
        return res.status(400).json({ error: "ensName and ownerAddress are required" });
      }
      if (!ensName.endsWith(".eth")) {
        return res.status(400).json({ error: "ensName must end with .eth" });
      }

      await upsertProfile({
        ensName,
        ownerAddress,
        token: token || "USDC",
        network: network || "base",
        dex: dex || "uniswap",
        slippage: slippage || "0.5",
        note: note || "",
        stealth: stealth === true,
      });

      return res.status(200).json({ ok: true });
    }

    // DELETE /api/profile?ens=alice.eth&address=0x...
    if (req.method === "DELETE") {
      const { ens, address } = req.query;
      if (typeof ens !== "string" || typeof address !== "string") {
        return res.status(400).json({ error: "Missing ens or address" });
      }
      const deleted = await deleteProfile(ens, address);
      return res.status(200).json({ ok: deleted });
    }

    res.setHeader("Allow", ["GET", "POST", "DELETE"]);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("[/api/profile]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// Strip MongoDB internals from responses
function sanitize(profile: ENSProfile) {
  const { ...rest } = profile;
  return rest;
}
