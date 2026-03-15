import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { JsonRpcProvider } from "ethers";
import { useAccount } from "wagmi";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import Layout from "@/components/Layout";

type DashboardTab = "sender" | "receiver";

type StoredTransaction = {
  id: string;
  type: "pay" | "swap";
  direction: "sent" | "received";
  fromENS: string;
  toENS: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  token: string;
  inputToken?: string;
  isStealthy: boolean;
  timestamp: number;
  network: string;
};

type PreferenceSummary = {
  ensName: string;
  token: string;
  dex: string;
  slippage: string;
  stealth: string;
};

const STORAGE_KEY = "enspay_transactions";
const SEPOLIA_RPC = process.env.NEXT_PUBLIC_ETH_SEPOLIA_RPC || "https://rpc.sepolia.org";
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEMO_ENS = ["alice.eth", "bob.eth", "vitalik.eth", "nick.eth", "ens.eth"];

function formatAmount(value: number) {
  if (!Number.isFinite(value)) return "0";
  return value % 1 === 0 ? String(value) : value.toFixed(2);
}

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function readTransactions(): StoredTransaction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredTransaction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function truncateAddress(value?: string) {
  if (!value) return "Unknown";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function getChartData(transactions: StoredTransaction[]) {
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(now.getDate() - (6 - index));
    return {
      label: DAY_LABELS[date.getDay()],
      dateKey: date.toISOString().slice(0, 10),
      volume: 0
    };
  });

  const dayIndex = new Map(days.map((day, index) => [day.dateKey, index]));

  transactions.forEach((tx) => {
    const dateKey = new Date(tx.timestamp).toISOString().slice(0, 10);
    const index = dayIndex.get(dateKey);
    if (index !== undefined) {
      days[index].volume += tx.amount;
    }
  });

  return days;
}

function seedDemoTransactions() {
  const now = Date.now();
  const seeded: StoredTransaction[] = Array.from({ length: 15 }, (_, index) => {
    const sent = index % 2 === 0;
    const stealthy = index % 4 === 0;
    const fromENS = sent ? "you.eth" : DEMO_ENS[(index + 1) % DEMO_ENS.length];
    const toENS = sent ? DEMO_ENS[index % DEMO_ENS.length] : "you.eth";
    const amount = Math.floor(Math.random() * 96) + 5;
    const randomDays = Math.floor(Math.random() * 7);
    const timestamp = now - randomDays * 24 * 60 * 60 * 1000 - Math.floor(Math.random() * 86_400_000);

    return {
      id: `0xseed${index}${Math.random().toString(16).slice(2, 10)}`,
      type: (index % 3 === 0 ? "swap" : "pay") as "pay" | "swap",
      direction: (sent ? "sent" : "received") as "sent" | "received",
      fromENS,
      toENS,
      fromAddress: `0x${(1000 + index).toString(16).padEnd(40, "0")}`,
      toAddress: `0x${(2000 + index).toString(16).padEnd(40, "0")}`,
      amount,
      token: "USDC",
      inputToken: index % 3 === 0 ? "WETH" : "USDC",
      isStealthy: stealthy,
      timestamp,
      network: "base-sepolia"
    };
  }).sort((a, b) => b.timestamp - a.timestamp);

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
}

function StatCard({
  label,
  value,
  subtext
}: {
  label: string;
  value: string;
  subtext: string;
}) {
  return (
    <div className="card">
      <p className="label-text">{label}</p>
      <p className="mt-3 font-heading text-3xl font-bold tracking-[-0.03em] text-[#F0EBE1]">{value}</p>
      <p className="mt-2 text-sm text-[#7A7570]">{subtext}</p>
    </div>
  );
}

function Avatar({
  ensName,
  stealthFallback
}: {
  ensName?: string;
  stealthFallback?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const label = ensName || "Anonymous";
  const first = label.charAt(0).toUpperCase() || "E";
  const src = ensName ? `https://metadata.ens.domains/mainnet/avatar/${encodeURIComponent(ensName)}` : "";

  if (!ensName || failed) {
    return (
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#3B82F6] to-[#1d4ed8] text-sm font-semibold text-white">
        {stealthFallback ? "🔒" : first}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={ensName}
      className="h-11 w-11 rounded-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function CustomTooltip({
  active,
  payload,
  label
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#1A1A1A",
        border: "1px solid #27272A",
        borderRadius: 8,
        color: "#F0EBE1",
        fontSize: 13,
        fontFamily: "Inter, sans-serif",
        padding: "10px 12px"
      }}
    >
      <p>{label}</p>
      <p>{formatAmount(Number(payload[0]?.value || 0))} USDC</p>
    </div>
  );
}

function EmptyChartOverlay({ message }: { message: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="rounded-[8px] border border-[#2E2B27] bg-[#242220]/90 px-4 py-2 text-sm text-[#7A7570]">
        {message}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState<DashboardTab>("sender");
  const [transactions, setTransactions] = useState<StoredTransaction[]>([]);
  const [preferences, setPreferences] = useState<PreferenceSummary | null>(null);
  const [preferencesError, setPreferencesError] = useState("");

  useEffect(() => {
    function load() {
      setTransactions(readTransactions().slice(0, 100));
    }

    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPreferences() {
      if (!address) {
        setPreferences(null);
        setPreferencesError("");
        return;
      }

      try {
        const provider = new JsonRpcProvider(SEPOLIA_RPC);
        const ensName = await provider.lookupAddress(address);

        if (!ensName) {
          if (!cancelled) {
            setPreferences(null);
            setPreferencesError("No ENS name found for connected wallet.");
          }
          return;
        }

        const resolver = await provider.getResolver(ensName);
        if (!resolver) {
          if (!cancelled) {
            setPreferences(null);
            setPreferencesError("No resolver found for connected ENS.");
          }
          return;
        }

        const [token, dex, slippage, stealth] = await Promise.all([
          resolver.getText("enspay.token"),
          resolver.getText("enspay.dex"),
          resolver.getText("enspay.slippage"),
          resolver.getText("enspay.stealth")
        ]);

        if (!cancelled) {
          setPreferences({
            ensName,
            token: token || "Not set",
            dex: dex || "Not set",
            slippage: slippage ? `${slippage}%` : "Not set",
            stealth: stealth === "true" ? "ON" : "OFF"
          });
          setPreferencesError("");
        }
      } catch {
        if (!cancelled) {
          setPreferences(null);
          setPreferencesError("Unable to load ENSPay preferences.");
        }
      }
    }

    void loadPreferences();
    return () => {
      cancelled = true;
    };
  }, [address]);

  const senderTransactions = useMemo(
    () => transactions.filter((tx) => tx.direction === "sent"),
    [transactions]
  );
  const receiverTransactions = useMemo(
    () => transactions.filter((tx) => tx.direction === "received"),
    [transactions]
  );

  const senderStats = useMemo(() => {
    const totalSent = senderTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const uniqueRecipients = new Set(senderTransactions.map((tx) => tx.toENS).filter(Boolean)).size;
    const avgPayment = senderTransactions.length ? totalSent / senderTransactions.length : 0;
    const routeMix = {
      pay: senderTransactions.filter((tx) => tx.type === "pay").length,
      swap: senderTransactions.filter((tx) => tx.type === "swap").length
    };

    const recipientMap = new Map<string, { count: number; total: number }>();
    senderTransactions.forEach((tx) => {
      const current = recipientMap.get(tx.toENS) || { count: 0, total: 0 };
      recipientMap.set(tx.toENS, {
        count: current.count + 1,
        total: current.total + tx.amount
      });
    });

    let topRecipient: { ensName: string; count: number; total: number } | null = null;
    recipientMap.forEach((value, key) => {
      if (!topRecipient || value.total > topRecipient.total) {
        topRecipient = { ensName: key, count: value.count, total: value.total };
      }
    });

    return { totalSent, uniqueRecipients, avgPayment, routeMix, topRecipient: topRecipient as { ensName: string; count: number; total: number } | null };
  }, [senderTransactions]);

  const receiverStats = useMemo(() => {
    const totalReceived = receiverTransactions.reduce((sum, tx) => sum + tx.amount, 0);
    const uniqueSenders = new Set(
      receiverTransactions.map((tx) => tx.fromENS || tx.fromAddress).filter(Boolean)
    ).size;
    const stealthPayments = receiverTransactions.filter((tx) => tx.isStealthy).length;
    return { totalReceived, uniqueSenders, stealthPayments };
  }, [receiverTransactions]);

  const senderChartData = useMemo(() => getChartData(senderTransactions), [senderTransactions]);
  const receiverChartData = useMemo(() => getChartData(receiverTransactions), [receiverTransactions]);

  const recentSent = senderTransactions.slice(0, 5);
  const recentReceived = receiverTransactions.slice(0, 5);
  const isEmpty = transactions.length === 0;

  return (
    <Layout title="Dashboard" wide>
      <div className="stagger grid gap-6">
        <div className="flex justify-start">
          <div className="inline-flex rounded-full border border-[#2E2B27] bg-[#242220] p-1">
            <button
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition ${
                activeTab === "sender" ? "bg-[#3B82F6] text-[#F0EBE1]" : "bg-transparent text-[#7A7570]"
              }`}
              onClick={() => setActiveTab("sender")}
            >
              Sender
            </button>
            <button
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition ${
                activeTab === "receiver" ? "bg-[#3B82F6] text-[#F0EBE1]" : "bg-transparent text-[#7A7570]"
              }`}
              onClick={() => setActiveTab("receiver")}
            >
              Receiver
            </button>
          </div>
        </div>

        {activeTab === "sender" && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <StatCard
                label="TOTAL SENT"
                value={`${formatAmount(senderStats.totalSent)} USDC`}
                subtext={`across ${senderTransactions.length} payments`}
              />
              <StatCard
                label="ENS NAMES PAID"
                value={String(senderStats.uniqueRecipients)}
                subtext="unique recipients"
              />
              <StatCard
                label="AVG PAYMENT"
                value={`${formatAmount(senderStats.avgPayment)} USDC`}
                subtext="per transaction"
              />
            </div>

            <div className="card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="section-title">Spending Over Time</p>
                  <p className="mt-2 text-sm text-[#7A7570]">Last 7 days of outgoing USDC volume</p>
                </div>
                <div className="flex gap-2">
                  <span className="badge">{senderStats.routeMix.pay} PAY</span>
                  <span className="badge">{senderStats.routeMix.swap} SWAP</span>
                </div>
              </div>
              <div className="divider mt-5" />
              <div className="relative mt-5 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={senderChartData}>
                    <CartesianGrid vertical={false} stroke="#2E2B27" />
                    <XAxis dataKey="label" stroke="#7A7570" tickLine={false} axisLine={false} />
                    <YAxis stroke="#7A7570" tickLine={false} axisLine={false} width={42} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="volume" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                {senderTransactions.length === 0 && <EmptyChartOverlay message="Make your first payment" />}
              </div>
            </div>

            <div className="card">
              <p className="section-title">Recent Payments</p>
              <div className="divider mt-5" />
              <div className="mt-2 grid gap-1">
                {recentSent.length === 0 && (
                  <p className="px-1 py-6 text-sm text-[#7A7570]">No transactions yet</p>
                )}
                {recentSent.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-4 rounded-[8px] px-1 py-4">
                    <Avatar ensName={tx.toENS} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base text-[#F0EBE1]">
                        you → {tx.toENS}
                        {tx.isStealthy && <span className="ml-2 text-[#3B82F6]">🔒</span>}
                      </p>
                      <p className="mt-1 text-sm text-[#7A7570]">{formatTimestamp(tx.timestamp)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-semibold text-[#3B82F6]">
                        {formatAmount(tx.amount)} {tx.token}
                      </p>
                      <span className="badge mt-2 inline-flex">{tx.type === "swap" ? "SWAP" : "PAY"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {(() => {
              const top = senderStats.topRecipient;
              if (!top) return null;
              return (
                <div className="card">
                  <div className="flex items-center gap-4">
                    <Avatar ensName={top.ensName} />
                    <div>
                      <p className="label-text">TOP RECIPIENT</p>
                      <p className="mt-2 text-lg text-[#F0EBE1]">
                        Your most paid recipient: {top.ensName} · {top.count} payments · {formatAmount(top.total)} USDC total
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        )}

        {activeTab === "receiver" && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <StatCard
                label="TOTAL RECEIVED"
                value={`${formatAmount(receiverStats.totalReceived)} USDC`}
                subtext={`across ${receiverTransactions.length} payments`}
              />
              <StatCard
                label="UNIQUE SENDERS"
                value={String(receiverStats.uniqueSenders)}
                subtext="people paid you"
              />
              <StatCard
                label="STEALTH PAYMENTS"
                value={String(receiverStats.stealthPayments)}
                subtext="🔒 private receipts"
              />
            </div>

            <div className="card">
              <div>
                <p className="section-title">Incoming Volume Over Time</p>
                <p className="mt-2 text-sm text-[#7A7570]">Last 7 days of received USDC volume</p>
              </div>
              <div className="divider mt-5" />
              <div className="mt-5 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={receiverChartData}>
                    <defs>
                      <linearGradient id="receiverVolume" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#2E2B27" />
                    <XAxis dataKey="label" stroke="#7A7570" tickLine={false} axisLine={false} />
                    <YAxis stroke="#7A7570" tickLine={false} axisLine={false} width={42} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="volume"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      fill="url(#receiverVolume)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <p className="section-title">Recent Receipts</p>
              <div className="divider mt-5" />
              <div className="mt-2 grid gap-1">
                {recentReceived.length === 0 && (
                  <p className="px-1 py-6 text-sm text-[#7A7570]">No transactions yet</p>
                )}
                {recentReceived.map((tx) => {
                  const senderLabel = tx.isStealthy ? "Anonymous" : tx.fromENS || truncateAddress(tx.fromAddress);
                  return (
                    <div key={tx.id} className="flex items-center gap-4 rounded-[8px] px-1 py-4">
                      <Avatar ensName={tx.isStealthy ? undefined : tx.fromENS} stealthFallback={tx.isStealthy} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base text-[#F0EBE1]">
                          {tx.isStealthy ? "🔒 Anonymous" : senderLabel} → you
                        </p>
                        <p className="mt-1 text-sm text-[#7A7570]">{formatTimestamp(tx.timestamp)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-semibold text-[#3B82F6]">
                          {formatAmount(tx.amount)} {tx.token}
                        </p>
                        <span className="badge mt-2 inline-flex">{tx.type === "swap" ? "SWAP" : "PAY"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card">
              <p className="section-title">Your current payment preferences</p>
              <div className="divider mt-5" />
              {preferences && (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <p className="text-sm text-[#F0EBE1]">
                    <span className="label-text mr-2">ENS</span>
                    {preferences.ensName}
                  </p>
                  <p className="text-sm text-[#F0EBE1]">
                    <span className="label-text mr-2">TOKEN</span>
                    {preferences.token}
                  </p>
                  <p className="text-sm text-[#F0EBE1]">
                    <span className="label-text mr-2">DEX</span>
                    {preferences.dex}
                  </p>
                  <p className="text-sm text-[#F0EBE1]">
                    <span className="label-text mr-2">SLIPPAGE</span>
                    {preferences.slippage}
                  </p>
                  <p className="text-sm text-[#F0EBE1]">
                    <span className="label-text mr-2">STEALTH</span>
                    {preferences.stealth}
                  </p>
                </div>
              )}
              {!preferences && (
                <p className="mt-5 text-sm text-[#7A7570]">
                  {preferencesError || "Connect a wallet with an ENS name to load your payment preferences."}
                </p>
              )}
              <Link href="/setup" className="btn btn-secondary mt-5 inline-flex">
                Edit Preferences →
              </Link>
            </div>
          </>
        )}

        {isEmpty && (
          <div className="card border-[#3B82F6]/40">
            <p className="section-title">Ready to send your first payment?</p>
            <p className="mt-3 text-sm text-[#7A7570]">
              This dashboard reads from your local ENSPay transaction history. Start with a payment to populate it.
            </p>
            <Link href="/" className="btn btn-primary mt-5 inline-flex">
              Pay Someone →
            </Link>
          </div>
        )}

        {process.env.NODE_ENV === "development" && (
          <button
            className="fixed bottom-4 right-4 z-[90] rounded-[6px] border border-[#2E2B27] bg-[#242220] px-3 py-2 text-[11px] uppercase tracking-[0.08em] text-[#7A7570] transition hover:border-[#3B82F6] hover:text-[#F0EBE1]"
            onClick={() => {
              seedDemoTransactions();
              setTransactions(readTransactions());
            }}
          >
            Seed Demo Data
          </button>
        )}
      </div>
    </Layout>
  );
}
