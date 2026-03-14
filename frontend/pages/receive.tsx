import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { JsonRpcProvider } from "ethers";
import Layout from "@/components/Layout";

const QRCodeSVG = dynamic(() => import("qrcode.react").then((m) => m.QRCodeSVG), { ssr: false });

type Mode = "static" | "stealth";

type QRState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; value: string; stealthAddress?: string }
  | { status: "error"; message: string };

export default function ReceivePage() {
  const [ensName, setEnsName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<Mode>("static");
  const [stealthEnabled, setStealthEnabled] = useState(false);
  const [qr, setQR] = useState<QRState>({ status: "idle" });
  const [copied, setCopied] = useState(false);

  // Check if receiver has stealth enabled on their ENS
  useEffect(() => {
    if (!ensName.endsWith(".eth")) {
      setStealthEnabled(false);
      return;
    }
    const provider = new JsonRpcProvider(
      process.env.NEXT_PUBLIC_ETH_SEPOLIA_RPC || "https://rpc.sepolia.org"
    );
    provider
      .getResolver(ensName)
      .then((r) => r?.getText("enspay.stealth"))
      .then((val) => setStealthEnabled(val === "true"))
      .catch(() => setStealthEnabled(false));
  }, [ensName]);

  const staticQRValue = useMemo(() => {
    if (!ensName) return "";
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const params = new URLSearchParams({ ens: ensName });
    if (amount) params.set("amount", amount);
    if (note) params.set("note", note);
    return `${base}/?${params.toString()}`;
  }, [ensName, amount, note]);

  async function generateQR() {
    if (!ensName) return;

    if (mode === "static") {
      setQR({ status: "ready", value: staticQRValue });
      return;
    }

    // Stealth: generate a one-time address
    setQR({ status: "loading" });
    try {
      const res = await fetch(`/api/stealth-address?ens=${encodeURIComponent(ensName)}`);
      const data = await res.json() as { stealthAddress?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to generate stealth address");

      // EIP-681 payment URI with stealth address — wallet apps can parse this directly
      // For USDC on Base Sepolia (chainId 84532)
      const stealthAddress = data.stealthAddress!;
      let qrValue = `ethereum:${stealthAddress}@84532`;
      if (amount) {
        // USDC transfer: ethereum:0xUSDC@84532/transfer?address=0xStealth&uint256=<amount in micro>
        const amountMicro = Math.round(parseFloat(amount) * 1_000_000);
        qrValue = `ethereum:0x036CbD53842c5426634e7929541eC2318f3dCF7e@84532/transfer?address=${stealthAddress}&uint256=${amountMicro}`;
      }

      setQR({ status: "ready", value: qrValue, stealthAddress });
    } catch (err) {
      setQR({ status: "error", message: err instanceof Error ? err.message : "Failed to generate QR" });
    }
  }

  const handleGenerate = useCallback(() => {
    void generateQR();
  }, [ensName, amount, note, mode, staticQRValue]);

  const qrDisplayValue = qr.status === "ready" ? qr.value : "";

  async function copyLink() {
    if (!qrDisplayValue) return;
    try {
      await navigator.clipboard.writeText(qrDisplayValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  function reset() {
    setQR({ status: "idle" });
    setCopied(false);
  }

  const canGenerate = ensName.endsWith(".eth");

  return (
    <Layout title="Receive Payment">
      <div className="grid gap-5">
        {/* Explainer */}
        <div className="sub-card grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1">
            <p className="font-medium text-[#F0EBE1]">Static QR</p>
            <p className="text-sm text-[#7A7570]">
              Reusable link — share it anywhere. Payers land on your ENSPay profile, pre-filled with amount and note.
            </p>
          </div>
          <div className="grid gap-1">
            <p className="font-medium text-[#F0EBE1]">Private QR (Stealth)</p>
            <p className="text-sm text-[#7A7570]">
              One-time address generated per QR. No two payments are linkable on-chain. Requires stealth mode enabled on your ENS.
            </p>
          </div>
        </div>

        <div className="card grid gap-4">
          <label className="grid gap-1">
            <span className="label-text">Your ENS Name</span>
            <input
              className="input"
              placeholder="alice.eth"
              value={ensName}
              onChange={(e) => { setEnsName(e.target.value.trim()); reset(); }}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="label-text">Request Amount (USDC) — optional</span>
              <input
                className="input"
                type="number"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); reset(); }}
              />
            </label>

            <label className="grid gap-1">
              <span className="label-text">Memo — optional</span>
              <input
                className="input"
                placeholder="Dinner, Invoice #42..."
                value={note}
                onChange={(e) => { setNote(e.target.value); reset(); }}
              />
            </label>
          </div>

          {/* Mode toggle */}
          <div className="grid gap-2">
            <span className="label-text">QR Mode</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                className={`sub-card text-center transition-colors ${mode === "static" ? "border-[#3B82F6] text-[#F0EBE1]" : "text-[#7A7570] hover:text-[#F0EBE1]"}`}
                onClick={() => { setMode("static"); reset(); }}
              >
                <p className="font-medium">Static</p>
                <p className="label-text mt-0.5">Reusable</p>
              </button>
              <button
                className={`sub-card text-center transition-colors ${mode === "stealth" ? "border-[#3B82F6] text-[#F0EBE1]" : "text-[#7A7570] hover:text-[#F0EBE1]"}`}
                onClick={() => { setMode("stealth"); reset(); }}
                disabled={!stealthEnabled}
                title={!stealthEnabled ? "Enable stealth mode in Setup first" : ""}
              >
                <p className={`font-medium ${!stealthEnabled ? "opacity-40" : ""}`}>🔒 Private</p>
                <p className={`label-text mt-0.5 ${!stealthEnabled ? "opacity-40" : ""}`}>
                  {stealthEnabled ? "One-time address" : "Enable in Setup"}
                </p>
              </button>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={!canGenerate || qr.status === "loading"}
          >
            {qr.status === "loading" ? "Generating..." : "Generate QR"}
          </button>
        </div>

        {/* QR Display */}
        {qr.status === "error" && (
          <p className="text-sm text-[#EF4444]">{qr.message}</p>
        )}

        {qr.status === "ready" && (
          <div className="card grid gap-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="section-title">
                  {mode === "stealth" ? "Private Payment QR" : "Payment QR"}
                </h2>
                {amount && (
                  <p className="label-text mt-1">Requesting ${amount} USDC</p>
                )}
              </div>
              {mode === "stealth" && (
                <div className="badge badge-blue shrink-0">🔒 One-time</div>
              )}
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="rounded-[8px] bg-white p-4 shadow-lg">
                <QRCodeSVG
                  value={qrDisplayValue}
                  size={240}
                  bgColor="#ffffff"
                  fgColor="#1C1A17"
                  level="M"
                />
              </div>

              {mode === "stealth" && (qr as { stealthAddress?: string }).stealthAddress && (
                <div className="sub-card w-full">
                  <p className="label-text mb-1">One-time stealth address</p>
                  <p className="font-mono text-xs text-[#7A7570] break-all">
                    {(qr as { stealthAddress: string }).stealthAddress}
                  </p>
                </div>
              )}

              {mode === "static" && (
                <div className="sub-card w-full">
                  <p className="label-text mb-1">Payment link</p>
                  <p className="font-mono text-xs text-[#7A7570] break-all">{qrDisplayValue}</p>
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button className="btn btn-secondary" onClick={copyLink}>
                {copied ? "Copied ✓" : mode === "stealth" ? "Copy Address" : "Copy Link"}
              </button>
              <button className="btn btn-secondary" onClick={reset}>
                {mode === "stealth" ? "Generate New (fresh address)" : "Regenerate"}
              </button>
            </div>

            {mode === "stealth" && (
              <div className="badge badge-blue text-center">
                Each time you tap "Generate New", a fresh address is created — payments can never be linked
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
