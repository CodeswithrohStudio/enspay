import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { encodeFunctionData, namehash } from "viem";
import { sepolia } from "wagmi/chains";
import { JsonRpcProvider } from "ethers";
import Layout from "@/components/Layout";
import { ENS_RESOLVER_ABI, ENS_SEPOLIA_PUBLIC_RESOLVER } from "@/utils/contracts";
import type { ENSProfile } from "@/utils/mongodb";

// ─── Constants ────────────────────────────────────────────────────────────────

const TOKEN_OPTIONS = ["USDC", "USDT", "DAI", "WETH"];
const NETWORK_OPTIONS = ["base", "arbitrum", "ethereum"];
const DEX_OPTIONS = ["uniswap", "aerodrome", "sushiswap"];

const TOKEN_ICONS: Record<string, string> = {
  USDC: "/icons/usdc.svg",
  USDT: "/icons/usdt.svg",
  DAI: "/icons/dai.svg",
  WETH: "/icons/weth.svg",
};
const NETWORK_ICONS: Record<string, string> = {
  base: "/icons/base.svg",
  arbitrum: "/icons/arbitrum.svg",
  ethereum: "/icons/ethereum.svg",
};
const DEX_ICONS: Record<string, string> = {
  uniswap: "/icons/uniswap.svg",
  aerodrome: "/icons/aerodrome.svg",
  sushiswap: "/icons/sushiswap.svg",
};

function timeAgo(date: Date | string): string {
  const ms = Date.now() - new Date(date).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

type EditForm = {
  token: string;
  network: string;
  dex: string;
  slippage: string;
  note: string;
  stealth: boolean;
};

function EditModal({
  profile,
  onSaved,
  onClose,
}: {
  profile: ENSProfile;
  onSaved: (updated: ENSProfile) => void;
  onClose: () => void;
}) {
  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [form, setForm] = useState<EditForm>({
    token: profile.token,
    network: profile.network,
    dex: profile.dex,
    slippage: profile.slippage,
    note: profile.note,
    stealth: profile.stealth,
  });
  const [saving, setSaving] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | null>(null);

  const { isLoading: confirming } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: Boolean(txHash) },
  });

  function set<K extends keyof EditForm>(key: K, val: EditForm[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function save() {
    if (!address) { setError("Connect wallet first."); return; }
    setSaving(true);
    setError(null);
    try {
      // Switch to Sepolia for ENS resolver
      if (chainId !== sepolia.id) await switchChainAsync({ chainId: sepolia.id });

      const node = namehash(profile.ensName);
      const provider = new JsonRpcProvider(
        process.env.NEXT_PUBLIC_ETH_SEPOLIA_RPC || "https://rpc.sepolia.org"
      );
      const resolver = await provider.getResolver(profile.ensName);
      const resolverAddress = resolver?.address || ENS_SEPOLIA_PUBLIC_RESOLVER;

      const records: [string, string][] = [
        ["enspay.token", form.token],
        ["enspay.network", form.network],
        ["enspay.dex", form.dex],
        ["enspay.slippage", form.slippage],
        ["enspay.note", form.note],
        ["enspay.stealth", form.stealth ? "true" : "false"],
      ];

      const calls = records.map(([key, value]) =>
        encodeFunctionData({ abi: ENS_RESOLVER_ABI, functionName: "setText", args: [node, key, value] })
      );

      const hash = await writeContractAsync({
        address: resolverAddress as `0x${string}`,
        abi: ENS_RESOLVER_ABI,
        functionName: "multicall",
        args: [calls],
      });
      setTxHash(hash);

      // Save to MongoDB immediately (don't wait for chain confirmation)
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ensName: profile.ensName, ownerAddress: address, ...form }),
      });

      onSaved({ ...profile, ...form, updatedAt: new Date() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function SelectRow({ label, value, options, icons, onChange }: {
    label: string;
    value: string;
    options: string[];
    icons: Record<string, string>;
    onChange: (v: string) => void;
  }) {
    return (
      <div className="grid gap-1">
        <span className="label-text">{label}</span>
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`flex items-center gap-1.5 rounded-[6px] border px-3 py-1.5 text-sm transition-colors ${
                value === opt
                  ? "border-[#3B82F6] bg-[#3B82F6]/10 text-[#F0EBE1]"
                  : "border-[#2E2B27] text-[#7A7570] hover:border-[#7A7570] hover:text-[#F0EBE1]"
              }`}
            >
              <Image src={icons[opt]} alt={opt} width={14} height={14} className="rounded-[3px]" />
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-4">
      <div className="relative w-full max-w-lg rounded-[8px] border border-[#2E2B27] bg-[#242220] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#2E2B27] px-5 py-4">
          <div>
            <h3 className="section-title">Edit Preferences</h3>
            <p className="label-text mt-0.5">{profile.ensName}</p>
          </div>
          <button className="text-[#7A7570] hover:text-[#F0EBE1]" onClick={onClose}>✕</button>
        </div>

        <div className="p-5 grid gap-4">
          <SelectRow
            label="Preferred Token"
            value={form.token}
            options={TOKEN_OPTIONS}
            icons={TOKEN_ICONS}
            onChange={(v) => set("token", v)}
          />
          <SelectRow
            label="Preferred Chain"
            value={form.network}
            options={NETWORK_OPTIONS}
            icons={NETWORK_ICONS}
            onChange={(v) => set("network", v)}
          />
          <SelectRow
            label="Preferred DEX"
            value={form.dex}
            options={DEX_OPTIONS}
            icons={DEX_ICONS}
            onChange={(v) => set("dex", v)}
          />

          <label className="grid gap-1">
            <span className="label-text">Slippage (%)</span>
            <input
              className="input"
              type="number"
              step="0.1"
              min="0"
              max="50"
              value={form.slippage}
              onChange={(e) => set("slippage", e.target.value)}
            />
          </label>

          <label className="grid gap-1">
            <span className="label-text">Note (optional)</span>
            <textarea
              className="input min-h-[64px]"
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
            />
          </label>

          <label className="sub-card flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#F0EBE1]">Stealth Payments</p>
              <p className="label-text mt-0.5">Each payer sends to a one-time address</p>
            </div>
            <input
              type="checkbox"
              className="h-4 w-4 accent-blue-500"
              checked={form.stealth}
              onChange={(e) => set("stealth", e.target.checked)}
            />
          </label>

          {error && <p className="text-sm text-[#EF4444]">{error}</p>}
          {txHash && confirming && <p className="label-text">Waiting for confirmation...</p>}
          {txHash && !confirming && <p className="label-text text-[#22C55E]">Saved on-chain ✓</p>}

          <div className="grid gap-2 sm:grid-cols-2">
            <button className="btn btn-primary" onClick={save} disabled={saving || confirming}>
              {saving ? "Saving..." : "Save Preferences"}
            </button>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Profile card ─────────────────────────────────────────────────────────────

function ProfileCard({
  profile,
  onEdit,
}: {
  profile: ENSProfile;
  onEdit: (p: ENSProfile) => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const base = window.location.origin;
    await navigator.clipboard.writeText(`${base}/pay/${encodeURIComponent(profile.ensName)}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="card grid gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#2E2B27] bg-[#3B82F6]/10 text-base font-bold text-[#3B82F6]">
            {profile.ensName.replace(".eth", "").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h3 className="ens-title">{profile.ensName}</h3>
            <p className="label-text mt-0.5">Updated {timeAgo(profile.updatedAt)}</p>
          </div>
        </div>
        <button
          className="btn btn-secondary shrink-0 text-xs px-3 py-1.5"
          onClick={() => onEdit(profile)}
        >
          Edit
        </button>
      </div>

      <div className="divider" />

      {/* Preferences grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Token", value: profile.token, icon: TOKEN_ICONS[profile.token] },
          { label: "Chain", value: profile.network, icon: NETWORK_ICONS[profile.network] },
          { label: "DEX", value: profile.dex, icon: DEX_ICONS[profile.dex] },
          { label: "Slippage", value: `${profile.slippage}%`, icon: null },
        ].map(({ label, value, icon }) => (
          <div key={label} className="sub-card grid gap-1.5">
            <p className="label-text">{label}</p>
            <div className="flex items-center gap-1.5">
              {icon && <Image src={icon} alt={value} width={16} height={16} className="rounded-[3px]" />}
              <p className="text-sm font-medium text-[#F0EBE1]">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Note */}
      {profile.note && (
        <div className="sub-card text-sm text-[#7A7570]">
          &ldquo;{profile.note}&rdquo;
        </div>
      )}

      {/* Stealth badge */}
      {profile.stealth && (
        <div className="badge badge-blue w-fit">🔒 Stealth Payments Enabled</div>
      )}

      {/* Actions */}
      <div className="grid gap-2 sm:grid-cols-3">
        <Link
          href={`/pay/${encodeURIComponent(profile.ensName)}`}
          className="btn btn-secondary text-center text-xs"
        >
          View Pay Page
        </Link>
        <button className="btn btn-secondary text-xs" onClick={copyLink}>
          {copied ? "Copied ✓" : "Copy Pay Link"}
        </button>
        <Link
          href={`/receive?ens=${encodeURIComponent(profile.ensName)}`}
          className="btn btn-secondary text-center text-xs"
        >
          Generate QR
        </Link>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilesPage() {
  const { address, isConnected } = useAccount();
  const [profiles, setProfiles] = useState<ENSProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [editTarget, setEditTarget] = useState<ENSProfile | null>(null);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    fetch(`/api/profile?address=${address}`)
      .then((r) => r.json())
      .then((data: { profiles?: ENSProfile[] }) => {
        setProfiles(data.profiles ?? []);
      })
      .catch(() => {/* silent */})
      .finally(() => setLoading(false));
  }, [address]);

  function handleSaved(updated: ENSProfile) {
    setProfiles((prev) =>
      prev.map((p) => (p.ensName === updated.ensName ? updated : p))
    );
    setEditTarget(null);
  }

  return (
    <Layout title="My ENS Profiles" wide>
      {editTarget && (
        <EditModal
          profile={editTarget}
          onSaved={handleSaved}
          onClose={() => setEditTarget(null)}
        />
      )}

      <div className="grid gap-5">
        {/* Explainer */}
        <div className="sub-card grid gap-1">
          <p className="text-sm text-[#7A7570]">
            All ENS names you&apos;ve configured with ENSPay preferences. Anyone who pays you by ENS
            name will automatically use these preferences — right token, right chain, no coordination needed.
          </p>
          <div className="mt-3 flex gap-3">
            <Link href="/setup" className="btn btn-primary text-sm">
              + Register New ENS
            </Link>
          </div>
        </div>

        {/* Not connected */}
        {!isConnected && (
          <div className="sub-card text-center text-[#7A7570]">
            Connect your wallet to see your ENS profiles.
          </div>
        )}

        {/* Loading */}
        {isConnected && loading && (
          <div className="grid gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="skeleton h-48 w-full rounded-[8px]" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {isConnected && !loading && profiles.length === 0 && (
          <div className="card grid gap-3 text-center">
            <p className="text-4xl">🔍</p>
            <h3 className="section-title">No profiles yet</h3>
            <p className="text-sm text-[#7A7570]">
              Set up your first ENS name with payment preferences so anyone can pay you in one click.
            </p>
            <Link href="/setup" className="btn btn-primary mx-auto">
              Set Up Your ENS
            </Link>
          </div>
        )}

        {/* Profile cards */}
        {profiles.map((p) => (
          <ProfileCard key={p.ensName} profile={p} onEdit={setEditTarget} />
        ))}
      </div>
    </Layout>
  );
}
