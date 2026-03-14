import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import type { Event } from "@/utils/eventStore";

const QRCodeSVG = dynamic(() => import("qrcode.react").then((m) => m.QRCodeSVG), { ssr: false });

type TicketInfo = {
  event: Event;
  used: boolean;
};

export default function TicketPage() {
  const router = useRouter();
  const secret = typeof router.query.secret === "string" ? router.query.secret : "";

  const [info, setInfo] = useState<TicketInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!secret) return;
    setLoading(true);
    fetch("/api/verify-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, peek: true }),
    })
      .then((r) => r.json())
      .then((data: { valid?: boolean; event?: Event; used?: boolean; reason?: string }) => {
        if (data.event) {
          setInfo({ event: data.event, used: data.used ?? false });
        } else {
          setError("Ticket not found");
        }
      })
      .catch(() => setError("Failed to load ticket"))
      .finally(() => setLoading(false));
  }, [secret]);

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <Layout title="Your Private Ticket">
      <div className="grid gap-5">
        <Link href="/events" className="label-text hover:text-[#F0EBE1] transition-colors">
          ← Back to Events
        </Link>

        {loading && <div className="skeleton h-64 w-full rounded-[8px]" />}
        {error && <p className="text-sm text-[#EF4444]">{error}</p>}

        {!loading && !error && info && (
          <div className="card grid gap-5">
            <div>
              <h2 className="section-title">{info.event.title}</h2>
              <p className="label-text mt-1">{info.event.date} · {info.event.organizer}</p>
            </div>

            <div className="divider" />

            {info.used ? (
              <div className="sub-card border-[#EF4444] text-center">
                <p className="text-2xl">❌</p>
                <p className="font-medium text-[#EF4444] mt-1">Ticket already used</p>
                <p className="label-text mt-1">This ticket has been consumed at entry</p>
              </div>
            ) : (
              <>
                {/* QR Code */}
                <div className="flex flex-col items-center gap-4">
                  <p className="label-text">Show this QR at the event entrance</p>
                  <div className="rounded-[8px] bg-white p-4 shadow-lg">
                    <QRCodeSVG
                      value={secret}
                      size={220}
                      bgColor="#ffffff"
                      fgColor="#1C1A17"
                      level="H"
                    />
                  </div>
                  <div className="badge badge-blue text-center">
                    🔒 Your identity is never revealed at entry
                  </div>
                </div>

                <div className="divider" />

                {/* Secret display */}
                <div className="sub-card grid gap-3">
                  <div className="flex items-center justify-between">
                    <p className="label-text">Your ticket secret</p>
                    <button
                      className="label-text hover:text-[#F0EBE1] transition-colors"
                      onClick={copySecret}
                    >
                      {copied ? "Copied ✓" : "Copy"}
                    </button>
                  </div>
                  <p className="font-mono text-xs text-[#7A7570] break-all leading-relaxed">
                    {secret}
                  </p>
                </div>

                {/* Privacy guarantee */}
                <div className="sub-card grid gap-3">
                  <p className="label-text">Privacy guarantees</p>
                  <ul className="grid gap-2 text-sm text-[#7A7570]">
                    <li>
                      <span className="text-[#F0EBE1]">Zero identity linkage</span> — only the hash of your secret is stored. Your wallet address was never recorded.
                    </li>
                    <li>
                      <span className="text-[#F0EBE1]">Single-use</span> — once scanned at the door, this ticket is consumed and cannot be reused.
                    </li>
                    <li>
                      <span className="text-[#F0EBE1]">Save your secret</span> — this is the only place it appears. If lost, it cannot be recovered.
                    </li>
                  </ul>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
