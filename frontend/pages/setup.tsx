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

function shortHash(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

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
      <div className="card stagger">
        <p className="label-text">
          Connected wallet: {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected"}
        </p>
        <div className="divider" />

        <div className="grid gap-4">
          <label className="grid gap-1">
            <span className="label-text">Your ENS Name</span>
            <input
              className="input"
              placeholder="alice.eth"
              value={ensName}
              onChange={(e) => setEnsName(e.target.value.trim())}
            />
          </label>

          <label className="grid gap-1">
            <span className="label-text">Preferred Token</span>
            <input className="input" value={token} onChange={(e) => setToken(e.target.value)} />
          </label>

          <label className="grid gap-1">
            <span className="label-text">Preferred DEX</span>
            <input className="input" value={dex} onChange={(e) => setDex(e.target.value)} />
          </label>

          <label className="grid gap-1">
            <span className="label-text">Slippage (%)</span>
            <input
              className="input"
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
            />
          </label>

          <label className="grid gap-1">
            <span className="label-text">Note (optional)</span>
            <textarea className="input min-h-[88px]" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>

          <label className="sub-card flex items-center justify-between">
            <span className="label-text !text-[#F0EBE1]">Enable Stealth Payments</span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-blue-500"
              checked={stealth}
              onChange={(e) => setStealth(e.target.checked)}
            />
          </label>
        </div>
        <div className="divider" />

        <button className="btn btn-primary mt-5" onClick={savePreferences} disabled={disabled}>
          {isConfirming ? "Confirming..." : "Save Preferences"}
        </button>

        {status.error && <p className="mt-3 text-sm text-[#EF4444]">{status.error}</p>}
        {status.success && <p className="mt-3 text-sm text-[#22C55E]">{status.success}</p>}
        {status.hash && <p className="label-text mt-2">Last tx: {shortHash(status.hash)}</p>}
      </div>
    </Layout>
  );
}
