import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { JsonRpcProvider } from "ethers";
import { createPublicClient, formatUnits, http, parseAbiItem } from "viem";
import { baseSepolia } from "viem/chains";
import Layout from "@/components/Layout";
import { ENSPAY_ROUTER_ADDRESS } from "@/utils/contracts";

type ProfileData = {
  ensName: string;
  avatarUrl: string | null;
  note: string;
  token: string;
  dex: string;
  stealth: boolean;
  recipientAddress: string;
};

type TxRow = {
  amount: bigint;
  token: string;
};

const paymentEvent = parseAbiItem(
  "event PaymentRouted(address indexed sender, address indexed recipient, string ensName, address token, uint256 amount)"
);
const swapEvent = parseAbiItem(
  "event SwapRouted(address indexed sender, address indexed recipient, string ensName, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)"
);

export default function ShareablePayProfilePage() {
  const router = useRouter();
  const ensName = useMemo(() => {
    const raw = typeof router.query.ens === "string" ? router.query.ens : "";
    return decodeURIComponent(raw);
  }, [router.query.ens]);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!ensName) return;
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const provider = new JsonRpcProvider(
          process.env.NEXT_PUBLIC_ETH_SEPOLIA_RPC || "https://rpc.sepolia.org"
        );
        const resolver = await provider.getResolver(ensName);
        if (!resolver) throw new Error("No ENS resolver found.");

        const [avatarUrl, note, token, dex, stealth, recipientAddress] = await Promise.all([
          provider.getAvatar(ensName),
          resolver.getText("enspay.note"),
          resolver.getText("enspay.token"),
          resolver.getText("enspay.dex"),
          resolver.getText("enspay.stealth"),
          resolver.getAddress()
        ]);

        if (!recipientAddress) throw new Error("No recipient address found for ENS.");

        const client = createPublicClient({
          chain: baseSepolia,
          transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || "https://sepolia.base.org")
        });

        const [paymentLogs, swapLogs] = await Promise.all([
          client.getLogs({
            address: ENSPAY_ROUTER_ADDRESS as `0x${string}`,
            event: paymentEvent,
            args: { recipient: recipientAddress as `0x${string}` },
            fromBlock: 0n,
            toBlock: "latest"
          }),
          client.getLogs({
            address: ENSPAY_ROUTER_ADDRESS as `0x${string}`,
            event: swapEvent,
            args: { recipient: recipientAddress as `0x${string}` },
            fromBlock: 0n,
            toBlock: "latest"
          })
        ]);

        const rows: TxRow[] = [
          ...paymentLogs.map((log) => ({ amount: log.args.amount!, token: "USDC" })),
          ...swapLogs.map((log) => ({ amount: log.args.amountOut!, token: "USDC" }))
        ]
          .reverse()
          .slice(0, 5);

        if (!active) return;
        setProfile({
          ensName,
          avatarUrl,
          note: note || "",
          token: token || "USDC",
          dex: dex || "uniswap",
          stealth: stealth === "true",
          recipientAddress
        });
        setTxs(rows);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load payment profile.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [ensName]);

  async function copyLink() {
    try {
      const base = window.location.origin;
      await navigator.clipboard.writeText(`${base}/pay/${encodeURIComponent(ensName)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Layout title="Payment Profile">
      <div className="card mx-auto max-w-xl">
        {loading && <div className="skeleton h-16 w-full" />}
        {error && <p className="text-sm text-[#EF4444]">{error}</p>}

        {!loading && !error && profile && (
          <div className="stagger grid gap-5">
            <div className="flex items-center gap-4">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={`${profile.ensName} avatar`} className="h-16 w-16 rounded-full border border-white/20 object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-black/40 text-2xl">
                  {profile.ensName[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <h2 className="ens-title">{profile.ensName}</h2>
                <p className="label-text">
                  Prefers {profile.token} via {profile.dex}
                </p>
              </div>
            </div>

            {profile.note ? (
              <div className="rounded-xl border border-[#27272A] bg-[#1A1A1A] p-3 text-sm text-white/80">{profile.note}</div>
            ) : (
              <div className="rounded-xl border border-[#27272A] bg-[#1A1A1A] p-3 text-sm text-[#71717A]">No note set</div>
            )}

            {profile.stealth && (
              <div className="badge badge-blue">
                🔒 Stealth Payments Enabled
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href={`/?ens=${encodeURIComponent(profile.ensName)}`}
                className="btn btn-primary text-center"
              >
                Pay {profile.ensName}
              </Link>
              <button
                onClick={copyLink}
                className="btn btn-secondary"
              >
                {copied ? "Copied" : "Copy Payment Link"}
              </button>
            </div>

            <div className="rounded-xl border border-[#27272A] bg-[#1A1A1A] p-4">
              <h3 className="section-title">Recent Transactions</h3>
              <div className="mt-3 grid gap-2">
                {txs.length === 0 && <p className="label-text">No payments yet</p>}
                {txs.map((tx, i) => (
                  <div key={`${tx.amount.toString()}-${i}`} className="rounded-xl border border-[#27272A] bg-[#1A1A1A] p-2 text-sm">
                    {formatUnits(tx.amount, 6)} {tx.token}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
