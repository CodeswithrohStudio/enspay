import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/router";
import { JsonRpcProvider } from "ethers";
import { createPublicClient, formatUnits, http, parseAbiItem } from "viem";
import { baseSepolia } from "viem/chains";
import Layout from "@/components/Layout";
import { ENSPAY_ROUTER_ADDRESS } from "@/utils/contracts";

const QRCodeSVG = dynamic(() => import("qrcode.react").then((m) => m.QRCodeSVG), { ssr: false });

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

  // QR modal state
  const [showQR, setShowQR] = useState(false);
  const [stealthQRAddress, setStealthQRAddress] = useState<string | null>(null);
  const [stealthQRLoading, setStealthQRLoading] = useState(false);
  const [stealthQRError, setStealthQRError] = useState<string | null>(null);

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

  async function openQR() {
    if (!profile) return;
    setShowQR(true);
    setStealthQRAddress(null);
    setStealthQRError(null);

    if (profile.stealth) {
      // Generate a one-time stealth address for this QR scan
      setStealthQRLoading(true);
      try {
        const res = await fetch(`/api/stealth-address?ens=${encodeURIComponent(profile.ensName)}`);
        const data = await res.json();
        if (!res.ok) throw new Error((data as { error: string }).error);
        setStealthQRAddress((data as { stealthAddress: string }).stealthAddress);
      } catch (err) {
        setStealthQRError(err instanceof Error ? err.message : "Failed to generate stealth address.");
      } finally {
        setStealthQRLoading(false);
      }
    }
  }

  // What the QR encodes:
  // - Stealth mode: direct ethereum: payment URI to the one-time stealth address
  // - Normal mode: the /pay/[ens] URL for human-readable UX
  const qrValue = useMemo(() => {
    if (!profile) return "";
    if (profile.stealth && stealthQRAddress) {
      return `ethereum:${stealthQRAddress}`;
    }
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/pay/${encodeURIComponent(profile.ensName)}`;
  }, [profile, stealthQRAddress]);

  return (
    <Layout title="Payment Profile">
      {/* QR Modal */}
      {showQR && profile && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-4">
          <div className="relative w-full max-w-sm rounded-[8px] border border-[#2E2B27] bg-[#242220] p-6">
            <button
              className="absolute right-3 top-3 text-[#7A7570] transition hover:text-[#F0EBE1]"
              onClick={() => setShowQR(false)}
              aria-label="Close QR modal"
            >
              ✕
            </button>

            <h3 className="section-title mb-1">
              {profile.stealth ? "Private Payment QR" : "Payment QR"}
            </h3>
            <p className="label-text mb-5">
              {profile.stealth
                ? "One-time stealth address — unlinked from your wallet"
                : `Pay ${profile.ensName}`}
            </p>

            <div className="flex flex-col items-center gap-4">
              {profile.stealth && stealthQRLoading && (
                <div className="skeleton h-48 w-48" />
              )}
              {profile.stealth && stealthQRError && (
                <p className="text-sm text-[#EF4444]">{stealthQRError}</p>
              )}
              {(!profile.stealth || stealthQRAddress) && (
                <div className="rounded-[6px] bg-white p-3">
                  <QRCodeSVG value={qrValue} size={192} bgColor="#ffffff" fgColor="#1C1A17" level="M" />
                </div>
              )}

              {profile.stealth && stealthQRAddress && (
                <div className="sub-card w-full text-center">
                  <p className="label-text mb-1">One-time address</p>
                  <p className="font-mono text-xs text-[#F0EBE1] break-all">{stealthQRAddress}</p>
                </div>
              )}

              {!profile.stealth && (
                <div className="sub-card w-full text-center">
                  <p className="label-text mb-1">Payment link</p>
                  <p className="font-mono text-xs text-[#F0EBE1] break-all">{qrValue}</p>
                </div>
              )}

              <div className="badge badge-blue text-center">
                {profile.stealth
                  ? "🔒 Each scan generates a unique address — no two payments linkable"
                  : "Scan to pay " + profile.ensName}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card mx-auto max-w-xl">
        {loading && <div className="skeleton h-16 w-full" />}
        {error && <p className="text-sm text-[#EF4444]">{error}</p>}

        {!loading && !error && profile && (
          <div className="stagger grid gap-5">
            <div className="flex items-center gap-4">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={`${profile.ensName} avatar`} className="h-16 w-16 rounded-full border border-[#2E2B27] object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#2E2B27] bg-[#242220] text-2xl">
                  {profile.stealth ? "🔒" : profile.ensName[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <h2 className="ens-title">{profile.ensName}</h2>
                <p className="label-text">
                  Prefers {profile.token} via {profile.dex}
                </p>
              </div>
            </div>
            <div className="divider" />

            {profile.note ? (
              <div className="sub-card text-sm text-[#F0EBE1]">{profile.note}</div>
            ) : (
              <div className="sub-card text-sm text-[#7A7570]">No note set</div>
            )}

            {profile.stealth && (
              <div className="badge badge-blue">
                🔒 Stealth Payments Enabled
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <Link
                href={`/?ens=${encodeURIComponent(profile.ensName)}`}
                className="btn btn-primary text-center"
              >
                Pay {profile.ensName}
              </Link>
              <button onClick={openQR} className="btn btn-secondary">
                {profile.stealth ? "Private QR" : "Show QR"}
              </button>
              <button onClick={copyLink} className="btn btn-secondary">
                {copied ? "Copied" : "Copy Link"}
              </button>
            </div>
            <div className="divider" />

            <div className="sub-card">
              <h3 className="section-title">Recent Transactions</h3>
              <div className="mt-3 grid gap-2">
                {txs.length === 0 && <p className="label-text">No payments yet</p>}
                {txs.map((tx, i) => (
                  <div key={`${tx.amount.toString()}-${i}`} className="sub-card text-sm">
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
