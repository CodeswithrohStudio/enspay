import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { formatUnits, parseUnits } from "viem";
import { baseSepolia } from "wagmi/chains";
import {
  useAccount,
  usePublicClient,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract
} from "wagmi";
import Layout from "@/components/Layout";
import { getAmountOutMinimumFromSlippage, getENSPayPreferences, type ENSPayPreferences } from "@/utils/ens";
import { BASE_SEPOLIA_USDC, ENSPAY_ROUTER_ABI, ENSPAY_ROUTER_ADDRESS, ERC20_ABI } from "@/utils/contracts";

export default function HomePage() {
  const router = useRouter();
  const { isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: baseSepolia.id });

  const [ensName, setEnsName] = useState("");
  const [amount, setAmount] = useState("");
  const [inputToken, setInputToken] = useState(BASE_SEPOLIA_USDC);
  const [prefs, setPrefs] = useState<ENSPayPreferences | null>(null);
  const [resolving, setResolving] = useState(false);
  const [status, setStatus] = useState<{ error?: string; success?: string; hash?: `0x${string}` }>({});

  const { isLoading: confirming } = useWaitForTransactionReceipt({
    hash: status.hash,
    query: { enabled: Boolean(status.hash) }
  });

  const amountInBaseUnits = useMemo(() => {
    if (!amount) return null;
    try {
      return parseUnits(amount, 6);
    } catch {
      return null;
    }
  }, [amount]);

  useEffect(() => {
    if (!router.isReady) return;
    const queryEns = typeof router.query.ens === "string" ? router.query.ens : "";
    if (queryEns && !ensName) {
      setEnsName(queryEns);
    }
  }, [router.isReady, router.query.ens, ensName]);

  async function resolveEnsName() {
    setStatus({});
    setResolving(true);
    try {
      const data = await getENSPayPreferences(ensName.trim());
      setPrefs(data);
    } catch (err) {
      setPrefs(null);
      setStatus({ error: err instanceof Error ? err.message : "Failed to resolve ENS preferences." });
    } finally {
      setResolving(false);
    }
  }

  async function ensureBaseSepolia() {
    if (chainId !== baseSepolia.id) {
      await switchChainAsync({ chainId: baseSepolia.id });
    }
  }

  async function approve(token: `0x${string}`, value: bigint) {
    const approveHash = await writeContractAsync({
      address: token,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ENSPAY_ROUTER_ADDRESS as `0x${string}`, value]
    });
    await publicClient?.waitForTransactionReceipt({ hash: approveHash });
  }

  async function pay() {
    setStatus({});
    try {
      if (!isConnected) throw new Error("Connect wallet first.");
      if (!prefs) throw new Error("Resolve ENS first.");
      if (!amountInBaseUnits) throw new Error("Invalid amount.");
      await ensureBaseSepolia();
      await approve(BASE_SEPOLIA_USDC as `0x${string}`, amountInBaseUnits);

      const hash = await writeContractAsync({
        address: ENSPAY_ROUTER_ADDRESS as `0x${string}`,
        abi: ENSPAY_ROUTER_ABI,
        functionName: "resolveAndPay",
        args: [ensName, prefs.address as `0x${string}`, amountInBaseUnits]
      });
      setStatus({ hash, success: "Payment submitted." });
    } catch (err) {
      setStatus({ error: err instanceof Error ? err.message : "Payment failed." });
    }
  }

  async function swapAndPay() {
    setStatus({});
    try {
      if (!isConnected) throw new Error("Connect wallet first.");
      if (!prefs) throw new Error("Resolve ENS first.");
      if (!amountInBaseUnits) throw new Error("Invalid amount.");
      await ensureBaseSepolia();
      const tokenIn = (inputToken || BASE_SEPOLIA_USDC) as `0x${string}`;
      await approve(tokenIn, amountInBaseUnits);

      // MVP min-out estimate uses amountIn as a reference and applies ENS slippage.
      const minOut = getAmountOutMinimumFromSlippage(amountInBaseUnits, prefs.slippage);
      const hash = await writeContractAsync({
        address: ENSPAY_ROUTER_ADDRESS as `0x${string}`,
        abi: ENSPAY_ROUTER_ABI,
        functionName: "resolveAndSwap",
        args: [ensName, prefs.address as `0x${string}`, tokenIn, amountInBaseUnits, minOut]
      });
      setStatus({ hash, success: "Swap + payment submitted." });
    } catch (err) {
      setStatus({ error: err instanceof Error ? err.message : "Swap failed." });
    }
  }

  return (
    <Layout title="Pay or Swap by ENS">
      <div className="card p-6">
        <div className="grid gap-4">
          <label className="grid gap-1">
            <span className="text-sm text-white/70">Enter ENS Name</span>
            <input
              className="rounded border border-white/20 bg-black/30 p-2"
              placeholder="alice.eth"
              value={ensName}
              onChange={(e) => setEnsName(e.target.value)}
            />
          </label>
          <button
            className="w-fit rounded bg-accent px-4 py-2 font-medium disabled:opacity-50"
            onClick={resolveEnsName}
            disabled={!ensName || resolving}
          >
            {resolving ? "Resolving..." : "Resolve Preferences"}
          </button>
        </div>

        {prefs && (
          <div className="mt-5 rounded border border-white/15 p-4">
            <div className="flex items-center gap-2">
              <p className="font-medium">
                {ensName} prefers {prefs.token} on {prefs.network} via {prefs.dex}
              </p>
              {prefs.isStealthy && (
                <span className="rounded-full border border-accent/60 px-2 py-0.5 text-xs text-accent">
                  🔒 Stealth Mode
                </span>
              )}
            </div>
            <p className="text-sm text-white/70">Slippage: {prefs.slippage}%</p>
            {prefs.note && <p className="text-sm text-white/70">Note: {prefs.note}</p>}
            <p className="mt-1 text-xs text-white/60">
              Recipient: {prefs.isStealthy ? "Address hidden for privacy" : prefs.address}
            </p>
          </div>
        )}

        <div className="mt-6 grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm text-white/70">Amount (USDC decimals: 6)</span>
            <input
              className="rounded border border-white/20 bg-black/30 p-2"
              placeholder="10"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm text-white/70">Swap Input Token (Base Sepolia)</span>
            <input
              className="rounded border border-white/20 bg-black/30 p-2"
              value={inputToken}
              onChange={(e) => setInputToken(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            className="rounded bg-accent px-4 py-2 font-medium disabled:opacity-50"
            onClick={pay}
            disabled={!prefs || !amountInBaseUnits || confirming}
          >
            Pay
          </button>
          <button
            className="rounded border border-accent px-4 py-2 font-medium text-accent disabled:opacity-50"
            onClick={swapAndPay}
            disabled={!prefs || !amountInBaseUnits || confirming}
          >
            Swap &amp; Pay
          </button>
        </div>

        {status.error && <p className="mt-4 text-sm text-red-400">{status.error}</p>}
        {status.success && <p className="mt-4 text-sm text-green-400">{status.success}</p>}
        {status.hash && <p className="mt-2 text-xs text-white/60">Tx Hash: {status.hash}</p>}

        {amountInBaseUnits && (
          <p className="mt-2 text-xs text-white/60">
            Parsed amount: {formatUnits(amountInBaseUnits, 6)} USDC units
          </p>
        )}
      </div>
    </Layout>
  );
}
