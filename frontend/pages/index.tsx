import Image from "next/image";
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

type ChainVisual = {
  key: string;
  label: string;
  icon: string;
};

type TokenVisual = { symbol: string; icon: string; address: string };

const PAYER_CHAIN_OPTIONS: ChainVisual[] = [
  { key: "arbitrum", label: "Arbitrum", icon: "/icons/arbitrum.svg" },
  { key: "arbitrum-sepolia", label: "Arbitrum Sepolia", icon: "/icons/arbitrum.svg" },
  { key: "base-sepolia", label: "Base Sepolia", icon: "/icons/base.svg" },
  { key: "sepolia", label: "Ethereum Sepolia", icon: "/icons/ethereum.svg" }
];

function shortAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function getPayerChain(chainId?: number): ChainVisual {
  if (chainId === 84532) return { key: "base-sepolia", label: "Base Sepolia", icon: "/icons/base.svg" };
  if (chainId === 42161) return { key: "arbitrum", label: "Arbitrum", icon: "/icons/arbitrum.svg" };
  if (chainId === 421614) return { key: "arbitrum-sepolia", label: "Arbitrum Sepolia", icon: "/icons/arbitrum.svg" };
  if (chainId === 11155111) return { key: "sepolia", label: "Ethereum Sepolia", icon: "/icons/ethereum.svg" };
  return { key: "unknown", label: "Unknown Network", icon: "/icons/network.svg" };
}

function getReceiverChain(network?: string): ChainVisual {
  const value = (network || "").toLowerCase();
  if (value.includes("base")) return { key: "base", label: "Base", icon: "/icons/base.svg" };
  if (value.includes("arbitrum")) return { key: "arbitrum", label: "Arbitrum", icon: "/icons/arbitrum.svg" };
  if (value.includes("eth")) return { key: "ethereum", label: "Ethereum", icon: "/icons/ethereum.svg" };
  return { key: "unknown", label: "Unknown", icon: "/icons/network.svg" };
}

function getTokenIcon(token?: string) {
  if ((token || "").toUpperCase() === "USDC") return "/icons/usdc.svg";
  if ((token || "").toUpperCase() === "USDT") return "/icons/usdt.svg";
  if ((token || "").toUpperCase() === "DAI") return "/icons/dai.svg";
  if ((token || "").toUpperCase() === "WETH") return "/icons/weth.svg";
  return "/icons/network.svg";
}

function RouteAsset({
  title,
  chainLabel,
  chainIcon,
  tokenLabel,
  tokenIcon
}: {
  title: string;
  chainLabel: string;
  chainIcon: string;
  tokenLabel: string;
  tokenIcon: string;
}) {
  return (
    <div className="sub-card flex flex-col gap-3">
      <p className="label-text">{title}</p>
      <div className="flex items-center gap-2">
        <Image src={chainIcon} alt={chainLabel} width={24} height={24} className="rounded-[6px]" />
        <span className="text-sm">{chainLabel}</span>
      </div>
      <div className="flex items-center gap-2">
        <Image src={tokenIcon} alt={tokenLabel} width={24} height={24} className="rounded-[6px]" />
        <span className="text-sm">{tokenLabel}</span>
      </div>
    </div>
  );
}

function SelectionCheck() {
  return (
    <span className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#3B82F6] bg-[#3B82F6]/15 text-[11px] text-[#3B82F6]">
      ✓
    </span>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: baseSepolia.id });

  const [ensName, setEnsName] = useState("");
  const [amount, setAmount] = useState("");
  const [payerChainKey, setPayerChainKey] = useState("arbitrum");
  const [payerTokenSymbol, setPayerTokenSymbol] = useState("USDC");
  const [inputToken, setInputToken] = useState(BASE_SEPOLIA_USDC);
  const [prefs, setPrefs] = useState<ENSPayPreferences | null>(null);
  const [resolving, setResolving] = useState(false);
  const [successModal, setSuccessModal] = useState<{
    open: boolean;
    title: string;
    txHash?: `0x${string}`;
  }>({ open: false, title: "" });
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

  useEffect(() => {
    const detected = getPayerChain(chainId);
    if (detected.key !== "unknown") setPayerChainKey(detected.key);
  }, [chainId]);

  const payerTokenOptions = useMemo<TokenVisual[]>(
    () => [
      { symbol: "USDC", icon: "/icons/usdc.svg", address: BASE_SEPOLIA_USDC },
      {
        symbol: "USDT",
        icon: "/icons/usdt.svg",
        address: process.env.NEXT_PUBLIC_BASE_SEPOLIA_USDT || "0x0000000000000000000000000000000000000000"
      },
      {
        symbol: "DAI",
        icon: "/icons/dai.svg",
        address: process.env.NEXT_PUBLIC_BASE_SEPOLIA_DAI || "0x0000000000000000000000000000000000000000"
      },
      {
        symbol: "WETH",
        icon: "/icons/weth.svg",
        address: process.env.NEXT_PUBLIC_BASE_SEPOLIA_WETH || "0x0000000000000000000000000000000000000000"
      }
    ],
    []
  );

  const selectedPayerToken = useMemo(
    () => payerTokenOptions.find((t) => t.symbol === payerTokenSymbol) || payerTokenOptions[0],
    [payerTokenOptions, payerTokenSymbol]
  );

  useEffect(() => {
    setInputToken(selectedPayerToken.address);
  }, [selectedPayerToken]);

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
      if (payerTokenSymbol !== "USDC") throw new Error("Use Swap & Pay for non-USDC payer tokens.");
      await ensureBaseSepolia();
      await approve(BASE_SEPOLIA_USDC as `0x${string}`, amountInBaseUnits);

      const hash = await writeContractAsync({
        address: ENSPAY_ROUTER_ADDRESS as `0x${string}`,
        abi: ENSPAY_ROUTER_ABI,
        functionName: "resolveAndPay",
        args: [ensName, prefs.address as `0x${string}`, amountInBaseUnits]
      });
      setStatus({ hash, success: "Payment submitted." });
      setSuccessModal({
        open: true,
        title: `Payment of ${formatUnits(amountInBaseUnits, 6)} ${payerTokenSymbol} was submitted successfully.`,
        txHash: hash
      });
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
      if (selectedPayerToken.address === "0x0000000000000000000000000000000000000000") {
        throw new Error(`Missing Base Sepolia ${selectedPayerToken.symbol} token address in env.`);
      }
      await ensureBaseSepolia();
      const tokenIn = (inputToken || BASE_SEPOLIA_USDC) as `0x${string}`;
      await approve(tokenIn, amountInBaseUnits);

      const minOut = getAmountOutMinimumFromSlippage(amountInBaseUnits, prefs.slippage);
      const hash = await writeContractAsync({
        address: ENSPAY_ROUTER_ADDRESS as `0x${string}`,
        abi: ENSPAY_ROUTER_ABI,
        functionName: "resolveAndSwap",
        args: [ensName, prefs.address as `0x${string}`, tokenIn, amountInBaseUnits, minOut]
      });
      setStatus({ hash, success: "Swap + payment submitted." });
      setSuccessModal({
        open: true,
        title: `Swap and payment of ${formatUnits(amountInBaseUnits, 6)} ${payerTokenSymbol} was submitted successfully.`,
        txHash: hash
      });
    } catch (err) {
      setStatus({ error: err instanceof Error ? err.message : "Swap failed." });
    }
  }

  async function paySmart() {
    if (payerTokenSymbol === "USDC") {
      await pay();
      return;
    }
    await swapAndPay();
  }

  const payerChain = PAYER_CHAIN_OPTIONS.find((c) => c.key === payerChainKey) || getPayerChain(chainId);
  const receiverChain = getReceiverChain(prefs?.network);
  const crossChainDetected =
    Boolean(prefs) && payerChain.key !== "unknown" && receiverChain.key !== "unknown" && !payerChain.key.includes(receiverChain.key);

  return (
    <Layout title="Pay or Swap by ENS">
      <div className="card stagger">
        <div className="grid gap-4">
          <label className="grid gap-1">
            <span className="label-text">Enter ENS Name</span>
            <input
              className="input"
              placeholder="alice.eth"
              value={ensName}
              onChange={(e) => setEnsName(e.target.value)}
            />
          </label>
          <button className="btn btn-primary w-fit" onClick={resolveEnsName} disabled={!ensName || resolving}>
            {resolving ? "Resolving..." : "Resolve Preferences"}
          </button>
        </div>

        {prefs && (
          <>
            <div className="divider mt-5" />
            <div className="mt-5 sub-card">
              <div className="flex items-center gap-2">
                <p className="ens-title">
                  {ensName} prefers {prefs.token} on {prefs.network} via {prefs.dex}
                </p>
                {prefs.isStealthy && <span className="badge badge-blue">Stealth Mode</span>}
              </div>
              <p className="label-text mt-2">Slippage: {prefs.slippage}%</p>
              {prefs.note && <p className="label-text mt-2">Note: {prefs.note}</p>}
              <p className="label-text mt-2">
                Recipient: {prefs.isStealthy ? "Address hidden for privacy" : shortAddress(prefs.address)}
              </p>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
              <RouteAsset
                title="Payer Route"
                chainLabel={payerChain.label}
                chainIcon={payerChain.icon}
                tokenLabel={selectedPayerToken.symbol}
                tokenIcon={selectedPayerToken.icon}
              />
              <div className="label-text text-center !text-[#3B82F6]">TO</div>
              <RouteAsset
                title="Receiver Route"
                chainLabel={receiverChain.label}
                chainIcon={receiverChain.icon}
                tokenLabel={prefs.token || "USDC"}
                tokenIcon={getTokenIcon(prefs.token)}
              />
            </div>

            {crossChainDetected && (
              <p className="label-text mt-3 !text-[#3B82F6]">
                Cross-chain route detected. Current MVP execution happens on Base Sepolia.
              </p>
            )}
          </>
        )}

        <div className="divider mt-6" />

        <div className="mt-6 grid gap-3">
          <div className="grid gap-2">
            <span className="label-text">Payer Chain</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {PAYER_CHAIN_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`sub-card flex items-center gap-2 text-left transition-all ${
                    payerChainKey === option.key
                      ? "border-[#3B82F6] bg-[#3B82F6]/10 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.25)]"
                      : "hover:border-[#7A7570]"
                  }`}
                  onClick={() => setPayerChainKey(option.key)}
                >
                  <Image src={option.icon} alt={option.label} width={20} height={20} className="rounded-[4px]" />
                  <span className="text-sm">{option.label}</span>
                  {payerChainKey === option.key && <SelectionCheck />}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <span className="label-text">Payer Token</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {payerTokenOptions.map((token) => (
                <button
                  key={token.symbol}
                  type="button"
                  className={`sub-card flex items-center gap-2 text-left transition-all ${
                    payerTokenSymbol === token.symbol
                      ? "border-[#3B82F6] bg-[#3B82F6]/10 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.25)]"
                      : "hover:border-[#7A7570]"
                  }`}
                  onClick={() => setPayerTokenSymbol(token.symbol)}
                >
                  <Image src={token.icon} alt={token.symbol} width={20} height={20} className="rounded-[4px]" />
                  <span className="text-sm">{token.symbol}</span>
                  {payerTokenSymbol === token.symbol && <SelectionCheck />}
                </button>
              ))}
            </div>
          </div>

          <label className="grid gap-1">
            <span className="label-text">Amount (USDC decimals: 6)</span>
            <input
              className="input"
              placeholder="10"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <div className="sub-card flex items-center gap-3">
            <Image src={selectedPayerToken.icon} alt={selectedPayerToken.symbol} width={24} height={24} className="rounded-[6px]" />
            <div>
              <p className="label-text">Execution Token</p>
              <p className="text-sm">{selectedPayerToken.symbol}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button className="btn btn-primary" onClick={paySmart} disabled={!prefs || !amountInBaseUnits || confirming}>
            Pay
          </button>
        </div>

        {status.error && <p className="mt-4 text-sm text-[#EF4444]">{status.error}</p>}

        {amountInBaseUnits && <p className="label-text mt-2">Parsed amount: {formatUnits(amountInBaseUnits, 6)} USDC</p>}
      </div>

      {successModal.open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 px-4">
          <div className="relative w-full max-w-md rounded-[8px] border border-[#2E2B27] bg-[#242220] p-5">
            <button
              type="button"
              className="absolute right-3 top-3 text-sm text-[#7A7570] transition-colors hover:text-[#F0EBE1]"
              onClick={() => setSuccessModal({ open: false, title: "" })}
            >
              ✕
            </button>

            <img
              src="https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExZG5hMnFybmdjcjl3eHJzeXJkaGxiamtsaDhjOHZ0emx1anZ4dGI0aCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/11sBLVxNs7v6WA/giphy.gif"
              alt="Success animation"
              className="h-44 w-full rounded-[6px] object-cover"
            />

            <h3 className="section-title mt-4">Payment Submitted</h3>
            <p className="mt-2 text-sm text-[#F0EBE1]">{successModal.title}</p>
            {successModal.txHash && (
              <p className="label-text mt-2">Tx Hash: {shortAddress(successModal.txHash)}</p>
            )}

            {successModal.txHash && (
              <a
                href={`https://sepolia.basescan.org/tx/${successModal.txHash}`}
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
    </Layout>
  );
}
