import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  getBridgeQuote,
  getUSDCAddress,
  resolveDestChainId,
  isTestnet,
  SPOKE_POOL_ABI,
  type AcrossQuote,
} from "@/utils/bridge";

// ─── Types ───────────────────────────────────────────────────────────────────

type ChainVisual = { key: string; label: string; icon: string };
type TokenVisual = { symbol: string; icon: string; address: string };
type PageMode = "home" | "pay";

// ─── Constants ───────────────────────────────────────────────────────────────

const PAYER_CHAIN_OPTIONS: ChainVisual[] = [
  { key: "arbitrum", label: "Arbitrum", icon: "/icons/arbitrum.svg" },
  { key: "arbitrum-sepolia", label: "Arbitrum Sepolia", icon: "/icons/arbitrum.svg" },
  { key: "base-sepolia", label: "Base Sepolia", icon: "/icons/base.svg" },
  { key: "sepolia", label: "Ethereum Sepolia", icon: "/icons/ethereum.svg" }
];

const QUICK_ACTION_ICONS: Record<string, JSX.Element> = {
  scan: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Top-left corner */}
      <rect x="3" y="3" width="5" height="5" rx="0.5" />
      <rect x="4.5" y="4.5" width="2" height="2" fill="white" stroke="none" />
      {/* Top-right corner */}
      <rect x="16" y="3" width="5" height="5" rx="0.5" />
      <rect x="17.5" y="4.5" width="2" height="2" fill="white" stroke="none" />
      {/* Bottom-left corner */}
      <rect x="3" y="16" width="5" height="5" rx="0.5" />
      <rect x="4.5" y="17.5" width="2" height="2" fill="white" stroke="none" />
      {/* Data dots */}
      <rect x="12" y="3" width="2" height="2" fill="white" stroke="none" />
      <rect x="3" y="12" width="2" height="2" fill="white" stroke="none" />
      <rect x="12" y="12" width="2" height="2" fill="white" stroke="none" />
      <rect x="16" y="12" width="2" height="2" fill="white" stroke="none" />
      <rect x="12" y="16" width="2" height="2" fill="white" stroke="none" />
      <rect x="19" y="16" width="2" height="2" fill="white" stroke="none" />
      <rect x="16" y="19" width="2" height="2" fill="white" stroke="none" />
      <rect x="19" y="12" width="2" height="2" fill="white" stroke="none" />
    </svg>
  ),
  pay: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  ),
  receive: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  ),
  events: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </svg>
  ),
};

const QUICK_ACTIONS = [
  { id: "scan", label: "Scan QR", sub: "Any QR" },
  { id: "pay", label: "Pay by ENS", sub: "Send crypto" },
  { id: "receive", label: "Receive", sub: "Show QR" },
  { id: "events", label: "Events", sub: "Private pass" }
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  const v = (network || "").toLowerCase();
  if (v.includes("base")) return { key: "base", label: "Base", icon: "/icons/base.svg" };
  if (v.includes("arbitrum")) return { key: "arbitrum", label: "Arbitrum", icon: "/icons/arbitrum.svg" };
  if (v.includes("eth")) return { key: "ethereum", label: "Ethereum", icon: "/icons/ethereum.svg" };
  return { key: "unknown", label: "Unknown", icon: "/icons/network.svg" };
}

function getTokenIcon(token?: string) {
  const t = (token || "").toUpperCase();
  if (t === "USDC") return "/icons/usdc.svg";
  if (t === "USDT") return "/icons/usdt.svg";
  if (t === "DAI") return "/icons/dai.svg";
  if (t === "WETH") return "/icons/weth.svg";
  return "/icons/network.svg";
}

function ens2initials(name: string) {
  return name.replace(".eth", "").slice(0, 2).toUpperCase();
}

function parseQRResult(raw: string): { ens?: string; amount?: string } {
  try {
    // Handle full URL like https://app.com/?ens=alice.eth&amount=10
    if (raw.startsWith("http")) {
      const url = new URL(raw);
      return {
        ens: url.searchParams.get("ens") ?? undefined,
        amount: url.searchParams.get("amount") ?? undefined
      };
    }
    // Handle bare ENS name
    if (raw.endsWith(".eth")) return { ens: raw };
    // Handle EIP-681 ethereum:... — extract address only, no ENS mapping here
    if (raw.startsWith("ethereum:")) return {};
  } catch {
    // ignore parse errors
  }
  return {};
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RouteAsset({ title, chainLabel, chainIcon, tokenLabel, tokenIcon }: {
  title: string; chainLabel: string; chainIcon: string; tokenLabel: string; tokenIcon: string;
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

// ─── QR Scanner Modal ─────────────────────────────────────────────────────────

type ScannerState = "idle" | "starting" | "scanning" | "error" | "success";

function QRScannerModal({ onResult, onClose }: {
  onResult: (ens: string, amount?: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<ScannerState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pasteValue, setPasteValue] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
    stopCamera();
    onClose();
  }, [stopCamera, onClose]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  async function startCamera() {
    setState("starting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Use BarcodeDetector if available (Chrome/Android)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const BarcodeDetector = (window as any).BarcodeDetector as any;
      if (!BarcodeDetector) {
        setState("scanning");
        setError("QR auto-detection not supported in this browser. Paste a link below.");
        return;
      }

      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      setState("scanning");

      function tick() {
        if (!videoRef.current || !streamRef.current) return;
        detector
          .detect(videoRef.current)
          .then((codes: Array<{ rawValue: string }>) => {
            if (codes.length > 0) {
              const raw = codes[0].rawValue;
              const parsed = parseQRResult(raw);
              if (parsed.ens) {
                stopCamera();
                setState("success");
                onResult(parsed.ens, parsed.amount);
              } else {
                rafRef.current = requestAnimationFrame(tick);
              }
            } else {
              rafRef.current = requestAnimationFrame(tick);
            }
          })
          .catch(() => {
            rafRef.current = requestAnimationFrame(tick);
          });
      }
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Camera access denied.");
    }
  }

  function submitPaste() {
    const trimmed = pasteValue.trim();
    if (!trimmed) return;
    const parsed = parseQRResult(trimmed);
    if (parsed.ens) {
      stopCamera();
      onResult(parsed.ens, parsed.amount);
    } else if (trimmed.endsWith(".eth")) {
      stopCamera();
      onResult(trimmed);
    } else {
      setError("Could not find an ENS name in that input.");
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4">
      <div className="relative w-full max-w-sm rounded-[8px] border border-[#2E2B27] bg-[#242220]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2E2B27] px-5 py-4">
          <h3 className="section-title">Scan QR Code</h3>
          <button className="text-[#7A7570] hover:text-[#F0EBE1]" onClick={handleClose}>✕</button>
        </div>

        <div className="p-5 grid gap-4">
          {/* Camera viewfinder */}
          <div className="relative overflow-hidden rounded-[8px] bg-black" style={{ aspectRatio: "1" }}>
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              playsInline
              muted
            />
            {state === "idle" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#1C1A17]">
                <div className="text-4xl">⬛</div>
                <p className="label-text">Camera not started</p>
              </div>
            )}
            {state === "starting" && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#1C1A17]">
                <div className="skeleton h-8 w-32 rounded" />
              </div>
            )}
            {/* Corner guides */}
            {state === "scanning" && (
              <>
                <div className="pointer-events-none absolute left-4 top-4 h-8 w-8 border-l-2 border-t-2 border-[#3B82F6] rounded-tl-[4px]" />
                <div className="pointer-events-none absolute right-4 top-4 h-8 w-8 border-r-2 border-t-2 border-[#3B82F6] rounded-tr-[4px]" />
                <div className="pointer-events-none absolute bottom-4 left-4 h-8 w-8 border-b-2 border-l-2 border-[#3B82F6] rounded-bl-[4px]" />
                <div className="pointer-events-none absolute bottom-4 right-4 h-8 w-8 border-b-2 border-r-2 border-[#3B82F6] rounded-br-[4px]" />
                <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-px bg-[#3B82F6]/60 animate-pulse" />
              </>
            )}
          </div>

          {state === "idle" && (
            <button className="btn btn-primary" onClick={startCamera}>
              Start Camera
            </button>
          )}
          {state === "scanning" && (
            <p className="label-text text-center">Point at an ENSPay QR code...</p>
          )}
          {error && <p className="text-sm text-[#EF4444]">{error}</p>}

          <div className="divider" />

          {/* Paste fallback */}
          <div className="grid gap-2">
            <p className="label-text">Or paste a payment link / ENS name</p>
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                placeholder="alice.eth or https://..."
                value={pasteValue}
                onChange={(e) => setPasteValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitPaste()}
              />
              <button className="btn btn-secondary shrink-0" onClick={submitPaste}>
                Go
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const { isConnected, chainId, address } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: baseSepolia.id });

  // UI state
  const [mode, setMode] = useState<PageMode>("home");
  const [showScanner, setShowScanner] = useState(false);
  const [recentRecipients, setRecentRecipients] = useState<string[]>([]);

  // Payment state
  const [ensName, setEnsName] = useState("");
  const [amount, setAmount] = useState("");
  const [payerChainKey, setPayerChainKey] = useState("arbitrum");
  const [payerTokenSymbol, setPayerTokenSymbol] = useState("USDC");
  const [inputToken, setInputToken] = useState(BASE_SEPOLIA_USDC);
  const [prefs, setPrefs] = useState<ENSPayPreferences | null>(null);
  const [resolving, setResolving] = useState(false);
  const [successModal, setSuccessModal] = useState<{ open: boolean; title: string; txHash?: `0x${string}` }>({ open: false, title: "" });
  const [status, setStatus] = useState<{ error?: string; success?: string; hash?: `0x${string}` }>({});

  const { isLoading: confirming } = useWaitForTransactionReceipt({
    hash: status.hash,
    query: { enabled: Boolean(status.hash) }
  });

  // Load recent recipients from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("enspay-transactions");
      if (!stored) return;
      const txs = JSON.parse(stored) as Array<{ toENS?: string; direction?: string }>;
      const seen = new Set<string>();
      const recent: string[] = [];
      for (const tx of txs) {
        if (tx.direction === "sent" && tx.toENS && !seen.has(tx.toENS)) {
          seen.add(tx.toENS);
          recent.push(tx.toENS);
          if (recent.length >= 5) break;
        }
      }
      setRecentRecipients(recent);
    } catch {
      // ignore
    }
  }, []);

  // Read query params
  useEffect(() => {
    if (!router.isReady) return;
    const queryEns = typeof router.query.ens === "string" ? router.query.ens : "";
    const queryAmount = typeof router.query.amount === "string" ? router.query.amount : "";
    if (queryEns) {
      setEnsName(queryEns);
      setMode("pay");
    }
    if (queryAmount && !amount) setAmount(queryAmount);
  }, [router.isReady, router.query.ens, router.query.amount]);

  useEffect(() => {
    const detected = getPayerChain(chainId);
    if (detected.key !== "unknown") setPayerChainKey(detected.key);
  }, [chainId]);

  const payerTokenOptions = useMemo<TokenVisual[]>(() => [
    { symbol: "USDC", icon: "/icons/usdc.svg", address: BASE_SEPOLIA_USDC },
    { symbol: "USDT", icon: "/icons/usdt.svg", address: process.env.NEXT_PUBLIC_BASE_SEPOLIA_USDT || "0x0000000000000000000000000000000000000000" },
    { symbol: "DAI", icon: "/icons/dai.svg", address: process.env.NEXT_PUBLIC_BASE_SEPOLIA_DAI || "0x0000000000000000000000000000000000000000" },
    { symbol: "WETH", icon: "/icons/weth.svg", address: process.env.NEXT_PUBLIC_BASE_SEPOLIA_WETH || "0x0000000000000000000000000000000000000000" }
  ], []);

  const selectedPayerToken = useMemo(
    () => payerTokenOptions.find((t) => t.symbol === payerTokenSymbol) || payerTokenOptions[0],
    [payerTokenOptions, payerTokenSymbol]
  );

  useEffect(() => { setInputToken(selectedPayerToken.address); }, [selectedPayerToken]);

  const amountInBaseUnits = useMemo(() => {
    if (!amount) return null;
    try { return parseUnits(amount, 6); } catch { return null; }
  }, [amount]);

  // ── Blockchain actions ────────────────────────────────────────────────────

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

  async function ensureChain(targetChainId: number) {
    if (chainId !== targetChainId) await switchChainAsync({ chainId: targetChainId });
  }

  // Approve with a configurable spender (ENSPayRouter or SpokePool)
  async function approveToken(token: `0x${string}`, spender: `0x${string}`, value: bigint) {
    const h = await writeContractAsync({ address: token, abi: ERC20_ABI, functionName: "approve", args: [spender, value] });
    await publicClient?.waitForTransactionReceipt({ hash: h });
  }

  // Same-chain direct USDC payment via ENSPayRouter
  async function pay() {
    setStatus({});
    try {
      if (!isConnected) throw new Error("Connect wallet first.");
      if (!prefs) throw new Error("Resolve ENS first.");
      if (!amountInBaseUnits) throw new Error("Invalid amount.");
      if (payerTokenSymbol !== "USDC") throw new Error("Use a non-USDC token for swap flow.");
      await ensureChain(baseSepolia.id);
      await approveToken(BASE_SEPOLIA_USDC as `0x${string}`, ENSPAY_ROUTER_ADDRESS as `0x${string}`, amountInBaseUnits);
      const hash = await writeContractAsync({ address: ENSPAY_ROUTER_ADDRESS as `0x${string}`, abi: ENSPAY_ROUTER_ABI, functionName: "resolveAndPay", args: [ensName, prefs.address as `0x${string}`, amountInBaseUnits] });
      setStatus({ hash, success: "Payment submitted." });
      setSuccessModal({ open: true, title: `Payment of ${formatUnits(amountInBaseUnits, 6)} USDC submitted on Base Sepolia.`, txHash: hash });
    } catch (err) {
      setStatus({ error: err instanceof Error ? err.message : "Payment failed." });
    }
  }

  // Same-chain swap + pay via ENSPayRouter (non-USDC payer token)
  async function swapAndPay() {
    setStatus({});
    try {
      if (!isConnected) throw new Error("Connect wallet first.");
      if (!prefs) throw new Error("Resolve ENS first.");
      if (!amountInBaseUnits) throw new Error("Invalid amount.");
      if (selectedPayerToken.address === "0x0000000000000000000000000000000000000000") throw new Error(`Missing Base Sepolia ${selectedPayerToken.symbol} address in env.`);
      await ensureChain(baseSepolia.id);
      const tokenIn = (inputToken || BASE_SEPOLIA_USDC) as `0x${string}`;
      await approveToken(tokenIn, ENSPAY_ROUTER_ADDRESS as `0x${string}`, amountInBaseUnits);
      const minOut = getAmountOutMinimumFromSlippage(amountInBaseUnits, prefs.slippage);
      const hash = await writeContractAsync({ address: ENSPAY_ROUTER_ADDRESS as `0x${string}`, abi: ENSPAY_ROUTER_ABI, functionName: "resolveAndSwap", args: [ensName, prefs.address as `0x${string}`, tokenIn, amountInBaseUnits, minOut] });
      setStatus({ hash, success: "Swap + payment submitted." });
      setSuccessModal({ open: true, title: `Swap and payment of ${formatUnits(amountInBaseUnits, 6)} ${payerTokenSymbol} submitted.`, txHash: hash });
    } catch (err) {
      setStatus({ error: err instanceof Error ? err.message : "Swap failed." });
    }
  }

  // Cross-chain payment via Across Protocol depositV3
  async function bridgePay(quote: AcrossQuote) {
    setStatus({});
    try {
      if (!isConnected) throw new Error("Connect wallet first.");
      if (!prefs || !amountInBaseUnits || !address) throw new Error("Invalid state.");

      // Stay on payer's chain — do NOT switch to Base Sepolia
      await ensureChain(quote.originChainId);

      // Approve USDC to the SpokePool on the payer's chain
      await approveToken(quote.inputToken, quote.spokePoolAddress, amountInBaseUnits);

      // Call depositV3 on the origin SpokePool
      const hash = await writeContractAsync({
        address: quote.spokePoolAddress,
        abi: SPOKE_POOL_ABI,
        functionName: "depositV3",
        args: [
          address,                          // depositor
          prefs.address as `0x${string}`,   // recipient on destination chain
          quote.inputToken,                 // inputToken (USDC on origin)
          quote.outputToken,                // outputToken (USDC on destination)
          amountInBaseUnits,                // inputAmount
          quote.outputAmount,               // outputAmount (after bridge fee)
          BigInt(quote.destinationChainId), // destinationChainId
          quote.exclusiveRelayer,           // exclusiveRelayer
          quote.quoteTimestamp,             // quoteTimestamp
          quote.fillDeadline,               // fillDeadline
          quote.exclusivityDeadline,        // exclusivityDeadline
          "0x",                             // message (empty)
        ],
      });

      const estFill = quote.estimatedFillTimeSec
        ? ` Estimated delivery: ~${quote.estimatedFillTimeSec}s.`
        : "";
      const feeUSDC = formatUnits(quote.totalRelayFee.total, 6);
      const outUSDC = formatUnits(quote.outputAmount, 6);

      setStatus({ hash, success: "Bridge deposit submitted." });
      setSuccessModal({
        open: true,
        title: `Cross-chain payment via Across Protocol. ${outUSDC} USDC will arrive on ${prefs.network} (fee: ${feeUSDC} USDC).${estFill}`,
        txHash: hash,
      });
    } catch (err) {
      setStatus({ error: err instanceof Error ? err.message : "Bridge failed." });
    }
  }

  // Smart router: detects cross-chain vs same-chain and picks the right path
  async function paySmart() {
    if (!prefs || !amountInBaseUnits) return;
    setStatus({});

    const result = await getBridgeQuote({
      payerChainId: chainId ?? baseSepolia.id,
      receiverNetwork: prefs.network,
      amount: amountInBaseUnits,
    });

    if (result.isSameChain) {
      // Same chain — use ENSPayRouter
      if (payerTokenSymbol === "USDC") await pay();
      else await swapAndPay();
      return;
    }

    if (!result.ok) {
      // Cross-chain route unavailable (e.g., testnets)
      const isTestnetRoute = isTestnet(chainId ?? 0) && isTestnet(resolveDestChainId(prefs.network, chainId ?? 0));
      if (isTestnetRoute) {
        setStatus({
          error: `Cross-chain bridging via Across Protocol requires mainnet. Connect to mainnet Base or Arbitrum to use cross-chain routing. On testnet, receiver must prefer the same chain you are on.`,
        });
      } else {
        setStatus({ error: `Bridge unavailable: ${result.error}` });
      }
      return;
    }

    // Cross-chain — use Across bridge
    await bridgePay(result.quote);
  }

  const payerChain = PAYER_CHAIN_OPTIONS.find((c) => c.key === payerChainKey) || getPayerChain(chainId);
  const receiverChain = getReceiverChain(prefs?.network);
  // True cross-chain: payer's actual connected chain differs from receiver's preferred chain
  const destChainId = prefs ? resolveDestChainId(prefs.network, chainId ?? baseSepolia.id) : null;
  const crossChainDetected = Boolean(prefs) && destChainId !== null && destChainId !== (chainId ?? baseSepolia.id);

  function handleQRResult(ens: string, amt?: string) {
    setShowScanner(false);
    setEnsName(ens);
    if (amt) setAmount(amt);
    setMode("pay");
  }

  function handleQuickAction(id: string) {
    if (id === "scan") { setShowScanner(true); return; }
    if (id === "pay") { setMode("pay"); return; }
    if (id === "receive") { void router.push("/receive"); return; }
    if (id === "events") { void router.push("/events"); return; }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Layout title="ENSPay">
      {/* QR Scanner */}
      {showScanner && <QRScannerModal onResult={handleQRResult} onClose={() => setShowScanner(false)} />}

      {/* Success Modal */}
      {successModal.open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 px-4">
          <div className="relative w-full max-w-md rounded-[8px] border border-[#2E2B27] bg-[#242220] p-5">
            <button type="button" className="absolute right-3 top-3 text-sm text-[#7A7570] hover:text-[#F0EBE1]" onClick={() => setSuccessModal({ open: false, title: "" })}>✕</button>
            <img src="https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExZG5hMnFybmdjcjl3eHJzeXJkaGxiamtsaDhjOHZ0emx1anZ4dGI0aCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/11sBLVxNs7v6WA/giphy.gif" alt="Success" className="h-44 w-full rounded-[6px] object-cover" />
            <h3 className="section-title mt-4">Payment Submitted</h3>
            <p className="mt-2 text-sm text-[#F0EBE1]">{successModal.title}</p>
            {successModal.txHash && <p className="label-text mt-2">Tx: {shortAddress(successModal.txHash)}</p>}
            {successModal.txHash && (
              <a href={`https://sepolia.basescan.org/tx/${successModal.txHash}`} target="_blank" rel="noreferrer" className="btn btn-secondary mt-5 inline-flex">
                View On Explorer
              </a>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-5">

        {/* ── Search bar ── */}
        <div className="flex items-center gap-3 rounded-[8px] border border-[#2E2B27] bg-[#242220] px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7A7570" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            className="flex-1 bg-transparent text-sm text-[#F0EBE1] placeholder-[#7A7570] outline-none"
            placeholder="Pay anyone by ENS name..."
            value={mode === "pay" ? ensName : ""}
            onFocus={() => setMode("pay")}
            onChange={(e) => { setEnsName(e.target.value); setMode("pay"); }}
          />
          {mode === "pay" && ensName && (
            <button className="text-[#7A7570] hover:text-[#F0EBE1]" onClick={() => { setEnsName(""); setPrefs(null); setMode("home"); }}>✕</button>
          )}
        </div>

        {/* ── Quick actions ── */}
        <div className="grid grid-cols-4 gap-3">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => handleQuickAction(action.id)}
              className="flex flex-col items-center gap-2 rounded-[8px] border border-[#2E2B27] bg-[#242220] p-3 transition-colors hover:border-[#3B82F6] hover:bg-[#3B82F6]/5"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#3B82F6]">
                {QUICK_ACTION_ICONS[action.id]}
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-[#F0EBE1] leading-tight">{action.label}</p>
                <p className="text-[10px] text-[#7A7570] leading-tight mt-0.5">{action.sub}</p>
              </div>
            </button>
          ))}
        </div>

        {/* ── Recent recipients ── */}
        {mode === "home" && (
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <p className="label-text">Recent</p>
              <Link href="/dashboard" className="label-text hover:text-[#F0EBE1] transition-colors">All →</Link>
            </div>

            {recentRecipients.length === 0 ? (
              <div className="flex gap-4 overflow-x-auto pb-1">
                {["alice.eth", "bob.eth", "carol.eth"].map((name) => (
                  <button
                    key={name}
                    onClick={() => { setEnsName(name); setMode("pay"); }}
                    className="flex shrink-0 flex-col items-center gap-2"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-[#2E2B27] bg-[#242220] text-sm font-semibold text-[#7A7570]">
                      {ens2initials(name)}
                    </div>
                    <p className="text-xs text-[#7A7570] max-w-[56px] truncate">{name.replace(".eth", "")}</p>
                  </button>
                ))}
                <button
                  onClick={() => setMode("pay")}
                  className="flex shrink-0 flex-col items-center gap-2"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#2E2B27] bg-[#242220] text-xl text-[#7A7570]">
                    +
                  </div>
                  <p className="text-xs text-[#7A7570]">New</p>
                </button>
              </div>
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-1">
                {recentRecipients.map((name) => (
                  <button
                    key={name}
                    onClick={() => { setEnsName(name); setMode("pay"); }}
                    className="flex shrink-0 flex-col items-center gap-2"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#2E2B27] bg-[#3B82F6]/10 text-sm font-bold text-[#3B82F6]">
                      {ens2initials(name)}
                    </div>
                    <p className="text-xs text-[#F0EBE1] max-w-[56px] truncate">{name.replace(".eth", "")}</p>
                  </button>
                ))}
                <button onClick={() => setMode("pay")} className="flex shrink-0 flex-col items-center gap-2">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#2E2B27] bg-[#242220] text-xl text-[#7A7570]">+</div>
                  <p className="text-xs text-[#7A7570]">New</p>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Payment panel ── */}
        {mode === "pay" && (
          <div className="card stagger grid gap-5">

            {/* ENS resolve row */}
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="alice.eth"
                value={ensName}
                onChange={(e) => { setEnsName(e.target.value); setPrefs(null); }}
              />
              <button className="btn btn-primary shrink-0" onClick={resolveEnsName} disabled={!ensName || resolving}>
                {resolving ? "..." : "Resolve"}
              </button>
            </div>

            {/* Receiver preferences */}
            {prefs && (
              <>
                <div className="sub-card grid gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="ens-title">{ensName}</p>
                    {prefs.isStealthy && <span className="badge badge-blue">🔒 Stealth</span>}
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <div>
                      <p className="label-text">Token</p>
                      <p className="text-sm text-[#F0EBE1] mt-0.5">{prefs.token}</p>
                    </div>
                    <div>
                      <p className="label-text">Network</p>
                      <p className="text-sm text-[#F0EBE1] mt-0.5">{prefs.network}</p>
                    </div>
                    <div>
                      <p className="label-text">Via</p>
                      <p className="text-sm text-[#F0EBE1] mt-0.5">{prefs.dex}</p>
                    </div>
                  </div>
                  {prefs.note && <p className="label-text mt-1">Note: {prefs.note}</p>}
                  <p className="label-text mt-1">
                    To: {prefs.isStealthy ? "🔒 Hidden (stealth)" : shortAddress(prefs.address)}
                  </p>
                </div>

                {/* Route visualization */}
                <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
                  <RouteAsset title="You send" chainLabel={payerChain.label} chainIcon={payerChain.icon} tokenLabel={selectedPayerToken.symbol} tokenIcon={selectedPayerToken.icon} />
                  <div className="label-text text-center !text-[#3B82F6]">
                    {crossChainDetected ? "⇌ Cross-chain" : "→"}
                  </div>
                  <RouteAsset title="They receive" chainLabel={receiverChain.label} chainIcon={receiverChain.icon} tokenLabel={prefs.token || "USDC"} tokenIcon={getTokenIcon(prefs.token)} />
                </div>
              </>
            )}

            <div className="divider" />

            {/* Amount input — big, like UPI */}
            <div className="grid gap-1">
              <p className="label-text">Amount (USDC)</p>
              <div className="flex items-center gap-3 rounded-[8px] border border-[#2E2B27] bg-[#1C1A17] px-4 py-3">
                <span className="text-2xl font-bold text-[#7A7570]">$</span>
                <input
                  className="flex-1 bg-transparent text-3xl font-bold text-[#F0EBE1] outline-none placeholder-[#7A7570]"
                  placeholder="0"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <span className="label-text">USDC</span>
              </div>
              {/* Quick amount pills */}
              <div className="flex gap-2 mt-1">
                {["10", "25", "50", "100"].map((v) => (
                  <button key={v} onClick={() => setAmount(v)} className={`rounded-full border px-3 py-1 text-xs transition-colors ${amount === v ? "border-[#3B82F6] bg-[#3B82F6]/10 text-[#3B82F6]" : "border-[#2E2B27] text-[#7A7570] hover:border-[#7A7570] hover:text-[#F0EBE1]"}`}>
                    ${v}
                  </button>
                ))}
              </div>
            </div>

            {/* Chain & token selectors */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <span className="label-text">Your Chain</span>
                <div className="grid gap-2">
                  {PAYER_CHAIN_OPTIONS.map((option) => (
                    <button key={option.key} type="button"
                      className={`sub-card flex items-center gap-2 text-left transition-all ${payerChainKey === option.key ? "border-[#3B82F6] bg-[#3B82F6]/10" : "hover:border-[#7A7570]"}`}
                      onClick={() => setPayerChainKey(option.key)}>
                      <Image src={option.icon} alt={option.label} width={18} height={18} className="rounded-[4px]" />
                      <span className="text-sm">{option.label}</span>
                      {payerChainKey === option.key && <SelectionCheck />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <span className="label-text">Your Token</span>
                <div className="grid gap-2">
                  {payerTokenOptions.map((token) => (
                    <button key={token.symbol} type="button"
                      className={`sub-card flex items-center gap-2 text-left transition-all ${payerTokenSymbol === token.symbol ? "border-[#3B82F6] bg-[#3B82F6]/10" : "hover:border-[#7A7570]"}`}
                      onClick={() => setPayerTokenSymbol(token.symbol)}>
                      <Image src={token.icon} alt={token.symbol} width={18} height={18} className="rounded-[4px]" />
                      <span className="text-sm">{token.symbol}</span>
                      {payerTokenSymbol === token.symbol && <SelectionCheck />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {status.error && <p className="text-sm text-[#EF4444]">{status.error}</p>}

            <button
              className="btn btn-primary w-full py-4 text-base font-semibold"
              onClick={paySmart}
              disabled={!prefs || !amountInBaseUnits || confirming}
            >
              {confirming
                ? "Confirming..."
                : crossChainDetected
                  ? `Bridge via Across → ${prefs?.network ?? ""}`
                  : `Pay ${ensName || ""}`
              }
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
