import Image from "next/image";
import { useMemo, useState } from "react";
import { JsonRpcProvider } from "ethers";
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

type SuccessModalState = {
  open: boolean;
  txHash?: `0x${string}`;
};

const DEX_OPTIONS = [
  { value: "uniswap", label: "Uniswap", icon: "/icons/uniswap.svg" },
  { value: "aerodrome", label: "Aerodrome", icon: "/icons/aerodrome.svg" },
  { value: "sushiswap", label: "SushiSwap", icon: "/icons/sushiswap.svg" }
];

const TOKEN_OPTIONS = [
  { value: "USDC", label: "USDC", icon: "/icons/usdc.svg" },
  { value: "USDT", label: "USDT", icon: "/icons/usdt.svg" },
  { value: "DAI", label: "DAI", icon: "/icons/dai.svg" },
  { value: "WETH", label: "WETH", icon: "/icons/weth.svg" }
];

const NETWORK_OPTIONS = [
  { value: "base", label: "Base", icon: "/icons/base.svg" },
  { value: "arbitrum", label: "Arbitrum", icon: "/icons/arbitrum.svg" },
  { value: "ethereum", label: "Ethereum", icon: "/icons/ethereum.svg" }
];

function shortHash(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export default function SetupPage() {
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [ensName, setEnsName] = useState("");
  const [token, setToken] = useState("USDC");
  const [network, setNetwork] = useState("base");
  const [dex, setDex] = useState("uniswap");
  const [slippage, setSlippage] = useState("0.5");
  const [note, setNote] = useState("");
  const [stealth, setStealth] = useState(false);
  const [status, setStatus] = useState<Status>({});
  const [successModal, setSuccessModal] = useState<SuccessModalState>({ open: false });
  const selectedToken = TOKEN_OPTIONS.find((option) => option.value === token) || TOKEN_OPTIONS[0];
  const selectedNetwork = NETWORK_OPTIONS.find((option) => option.value === network) || NETWORK_OPTIONS[0];
  const selectedDex = DEX_OPTIONS.find((option) => option.value === dex) || DEX_OPTIONS[0];

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
      const provider = new JsonRpcProvider(
        process.env.NEXT_PUBLIC_ETH_SEPOLIA_RPC || "https://rpc.sepolia.org"
      );
      const resolver = await provider.getResolver(ensName);
      const resolverAddress = resolver?.address || ENS_SEPOLIA_PUBLIC_RESOLVER;

      const records: Array<[string, string]> = [
        ["enspay.token", token || "USDC"],
        ["enspay.network", network || "base"],
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
        address: resolverAddress as `0x${string}`,
        abi: ENS_RESOLVER_ABI,
        functionName: "multicall",
        args: [batchedCalls]
      });

      setStatus({
        hash: finalHash,
        success: "Preferences saved in a single transaction."
      });
      setSuccessModal({ open: true, txHash: finalHash });

      // Persist to MongoDB for instant lookups on the Profiles page
      void fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ensName,
          ownerAddress: address,
          token: token || "USDC",
          network: network || "base",
          dex: dex || "uniswap",
          slippage: slippage || "0.5",
          note: note || "",
          stealth,
        }),
      });
    } catch (err) {
      setStatus({ error: err instanceof Error ? err.message : "Failed to save ENS text records." });
    }
  }

  return (
    <Layout title="Setup ENS Preferences">
      {successModal.open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 px-4">
          <div className="relative w-full max-w-md rounded-[8px] border border-[#2E2B27] bg-[#242220] p-5">
            <button
              className="absolute right-3 top-3 text-[#7A7570] transition hover:text-[#F0EBE1]"
              onClick={() => setSuccessModal({ open: false })}
              aria-label="Close success modal"
            >
              ✕
            </button>

            <img
              src="https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExZG5hMnFybmdjcjl3eHJzeXJkaGxiamtsaDhjOHZ0emx1anZ4dGI0aCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/11sBLVxNs7v6WA/giphy.gif"
              alt="Success animation"
              className="h-48 w-full rounded-[6px] object-cover"
            />
            <h3 className="section-title mt-4">Your preferences are set</h3>
            <p className="mt-2 text-sm text-[#F0EBE1]">
              ENSPay preferences were saved successfully and are now available for payments routed through your ENS.
            </p>
            {successModal.txHash && <p className="label-text mt-2">Tx Hash: {shortHash(successModal.txHash)}</p>}
            {successModal.txHash && (
              <a
                href={`https://sepolia.etherscan.io/tx/${successModal.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary mt-5 inline-flex"
              >
                View On Explorer
              </a>
            )}
          </div>
        </div>
      )}

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
            <div className="relative">
              <Image
                src={selectedToken.icon}
                alt={selectedToken.label}
                width={20}
                height={20}
                className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 rounded-[4px]"
              />
              <select
                className="input input-with-icon appearance-none"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              >
                {TOKEN_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#7A7570]">
                ▼
              </span>
            </div>
          </label>

          <label className="grid gap-1">
            <span className="label-text">Preferred Chain</span>
            <div className="relative">
              <Image
                src={selectedNetwork.icon}
                alt={selectedNetwork.label}
                width={20}
                height={20}
                className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 rounded-[4px]"
              />
              <select
                className="input input-with-icon appearance-none"
                value={network}
                onChange={(e) => setNetwork(e.target.value)}
              >
                {NETWORK_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#7A7570]">
                ▼
              </span>
            </div>
          </label>

          <label className="grid gap-1">
            <span className="label-text">Preferred DEX</span>
            <div className="relative">
              <Image
                src={selectedDex.icon}
                alt={selectedDex.label}
                width={20}
                height={20}
                className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 rounded-[4px]"
              />
              <select
                className="input input-with-icon appearance-none"
                value={dex}
                onChange={(e) => setDex(e.target.value)}
              >
                {DEX_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#7A7570]">
                ▼
              </span>
            </div>
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
      </div>
    </Layout>
  );
}
