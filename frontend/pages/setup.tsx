import { useMemo, useState } from "react";
import { useAccount, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { encodeFunctionData, namehash } from "viem";
import { sepolia } from "wagmi/chains";
import Layout from "@/components/Layout";
import { ENS_RESOLVER_ABI, ENS_SEPOLIA_PUBLIC_RESOLVER } from "@/utils/contracts";

type Status = {
  hash?: `0x${string}`;
  error?: string;
  success?: string;
};

export default function SetupPage() {
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [ensName, setEnsName] = useState("");
  const [token, setToken] = useState("USDC");
  const [dex, setDex] = useState("uniswap");
  const [slippage, setSlippage] = useState("0.5");
  const [note, setNote] = useState("");
  const [stealth, setStealth] = useState(false);
  const [status, setStatus] = useState<Status>({});

  const txHash = status.hash;
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: Boolean(txHash) }
  });

  const disabled = useMemo(() => !isConnected || !ensName || isConfirming, [isConnected, ensName, isConfirming]);

  async function savePreferences() {
    setStatus({});
    try {
      if (!address) throw new Error("Connect your wallet first.");
      if (!ensName.endsWith(".eth")) throw new Error("Enter a valid .eth name.");

      if (chainId !== sepolia.id) {
        await switchChainAsync({ chainId: sepolia.id });
      }

      const node = namehash(ensName);
      const records: Array<[string, string]> = [
        ["enspay.token", token || "USDC"],
        ["enspay.network", "base"],
        ["enspay.dex", dex || "uniswap"],
        ["enspay.slippage", slippage || "0.5"],
        ["enspay.note", note || ""],
        ["enspay.stealth", stealth ? "true" : "false"]
      ];

      const batchedCalls = records.map(([key, value]) =>
        encodeFunctionData({
          abi: ENS_RESOLVER_ABI,
          functionName: "setText",
          args: [node, key, value]
        })
      );

      const finalHash = await writeContractAsync({
        address: ENS_SEPOLIA_PUBLIC_RESOLVER,
        abi: ENS_RESOLVER_ABI,
        functionName: "multicall",
        args: [batchedCalls]
      });

      setStatus({
        hash: finalHash,
        success: "Preferences saved in a single transaction."
      });
    } catch (err) {
      setStatus({ error: err instanceof Error ? err.message : "Failed to save ENS text records." });
    }
  }

  return (
    <Layout title="Setup ENS Preferences">
      <div className="card p-6">
        <p className="mb-4 text-sm text-white/70">
          Connected wallet: {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected"}
        </p>

        <div className="grid gap-4">
          <label className="grid gap-1">
            <span className="text-sm text-white/70">Your ENS Name</span>
            <input
              className="rounded border border-white/20 bg-black/30 p-2"
              placeholder="alice.eth"
              value={ensName}
              onChange={(e) => setEnsName(e.target.value.trim())}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-white/70">Preferred Token</span>
            <input className="rounded border border-white/20 bg-black/30 p-2" value={token} onChange={(e) => setToken(e.target.value)} />
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-white/70">Preferred DEX</span>
            <input className="rounded border border-white/20 bg-black/30 p-2" value={dex} onChange={(e) => setDex(e.target.value)} />
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-white/70">Slippage (%)</span>
            <input
              className="rounded border border-white/20 bg-black/30 p-2"
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-white/70">Note (optional)</span>
            <textarea className="rounded border border-white/20 bg-black/30 p-2" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>

          <label className="flex items-center justify-between rounded border border-white/20 bg-black/30 p-3">
            <span className="text-sm text-white/80">Enable Stealth Payments</span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-blue-500"
              checked={stealth}
              onChange={(e) => setStealth(e.target.checked)}
            />
          </label>
        </div>

        <button
          className="mt-5 rounded bg-accent px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50"
          onClick={savePreferences}
          disabled={disabled}
        >
          {isConfirming ? "Confirming..." : "Save Preferences"}
        </button>

        {status.error && <p className="mt-3 text-sm text-red-400">{status.error}</p>}
        {status.success && <p className="mt-3 text-sm text-green-400">{status.success}</p>}
        {status.hash && <p className="mt-2 text-xs text-white/60">Last tx: {status.hash}</p>}
      </div>
    </Layout>
  );
}
