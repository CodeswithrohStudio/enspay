import { useEffect, useMemo, useState } from "react";
import { createPublicClient, formatUnits, http, parseAbiItem } from "viem";
import { baseSepolia } from "viem/chains";
import Layout from "@/components/Layout";
import { ENSPAY_ROUTER_ADDRESS } from "@/utils/contracts";

type RouteRow = {
  sender: string;
  recipient: string;
  recipientEns: string;
  amount: bigint;
  token: string;
  type: "pay" | "swap";
};

const paymentEvent = parseAbiItem(
  "event PaymentRouted(address indexed sender, address indexed recipient, string ensName, address token, uint256 amount)"
);
const swapEvent = parseAbiItem(
  "event SwapRouted(address indexed sender, address indexed recipient, string ensName, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)"
);

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function DashboardPage() {
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (ENSPAY_ROUTER_ADDRESS === "0x0000000000000000000000000000000000000000") {
          throw new Error("Set NEXT_PUBLIC_ENSPAY_ROUTER_ADDRESS first.");
        }

        const client = createPublicClient({
          chain: baseSepolia,
          transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || "https://sepolia.base.org")
        });

        const [paymentLogs, swapLogs] = await Promise.all([
          client.getLogs({
            address: ENSPAY_ROUTER_ADDRESS as `0x${string}`,
            event: paymentEvent,
            fromBlock: 0n,
            toBlock: "latest"
          }),
          client.getLogs({
            address: ENSPAY_ROUTER_ADDRESS as `0x${string}`,
            event: swapEvent,
            fromBlock: 0n,
            toBlock: "latest"
          })
        ]);

        const paymentRows: RouteRow[] = paymentLogs.map((log) => ({
          sender: log.args.sender!,
          recipient: log.args.recipient!,
          recipientEns: log.args.ensName!,
          amount: log.args.amount!,
          token: "USDC",
          type: "pay"
        }));

        const swapRows: RouteRow[] = swapLogs.map((log) => ({
          sender: log.args.sender!,
          recipient: log.args.recipient!,
          recipientEns: log.args.ensName!,
          amount: log.args.amountOut!,
          token: "USDC",
          type: "swap"
        }));

        const combined = [...paymentRows, ...swapRows].reverse();
        if (active) setRoutes(combined.slice(0, 50));
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to fetch routed transactions.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const totalTx = routes.length;
    const totalVolume = routes.reduce((acc, row) => acc + row.amount, 0n);
    const recent = routes.slice(0, 5);
    return { totalTx, totalVolume, recent };
  }, [routes]);

  return (
    <Layout title="Demo Dashboard">
      <div className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card p-5">
            <p className="text-sm text-white/70">Total Transactions Routed</p>
            <p className="mt-2 text-3xl font-semibold">{stats.totalTx}</p>
          </div>
          <div className="card p-5">
            <p className="text-sm text-white/70">Total Volume (USDC)</p>
            <p className="mt-2 text-3xl font-semibold">{formatUnits(stats.totalVolume, 6)}</p>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="text-lg font-semibold">Last 5 Recent Routes</h2>
          {loading && <p className="mt-3 text-sm text-white/70">Loading...</p>}
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          {!loading && !error && stats.recent.length === 0 && (
            <p className="mt-3 text-sm text-white/70">No routed transactions yet.</p>
          )}
          <div className="mt-3 grid gap-2">
            {stats.recent.map((row, idx) => (
              <div key={`${row.sender}-${row.recipient}-${idx}`} className="rounded border border-white/10 p-3 text-sm">
                {shortAddress(row.sender)} to {row.recipientEns} ({shortAddress(row.recipient)}) |{" "}
                {formatUnits(row.amount, 6)} {row.token} | {row.type}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
