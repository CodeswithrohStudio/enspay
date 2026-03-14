import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import type { Event } from "@/utils/eventStore";

export default function EventDetailPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ticket issuance state
  const [getting, setGetting] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/events/${id}`)
      .then((r) => r.json())
      .then((data: { event?: Event; error?: string }) => {
        if (data.event) setEvent(data.event);
        else setError(data.error ?? "Event not found");
      })
      .catch(() => setError("Failed to load event"))
      .finally(() => setLoading(false));
  }, [id]);

  async function getTicket() {
    if (!event) return;
    setGetting(true);
    setTicketError(null);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id }),
      });
      const data = await res.json() as { secret?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to issue ticket");
      // Navigate to ticket page — secret is in the URL fragment (never sent to server on page load)
      void router.push(`/ticket/${data.secret}`);
    } catch (err) {
      setTicketError(err instanceof Error ? err.message : "Failed to get ticket");
    } finally {
      setGetting(false);
    }
  }

  const remaining = event ? event.capacity - event.ticketsSold : 0;
  const soldOut = event ? event.ticketsSold >= event.capacity : false;
  const pct = event ? Math.round((event.ticketsSold / event.capacity) * 100) : 0;

  return (
    <Layout title={event?.title ?? "Event"}>
      <div className="grid gap-5">
        <Link href="/events" className="label-text hover:text-[#F0EBE1] transition-colors">
          ← Back to Events
        </Link>

        {loading && <div className="skeleton h-48 w-full rounded-[8px]" />}
        {error && <p className="text-sm text-[#EF4444]">{error}</p>}

        {!loading && !error && event && (
          <>
            <div className="card grid gap-5">
              <div>
                <h2 className="section-title">{event.title}</h2>
                <p className="label-text mt-1">Organized by {event.organizer}</p>
              </div>

              <div className="divider" />

              <p className="text-sm text-[#F0EBE1] leading-relaxed">{event.description}</p>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sub-card text-center">
                  <p className="label-text mb-1">Date</p>
                  <p className="font-medium text-[#F0EBE1]">{event.date}</p>
                </div>
                <div className="sub-card text-center">
                  <p className="label-text mb-1">Ticket Price</p>
                  <p className="ens-title text-[#3B82F6]">${event.ticketPrice} USDC</p>
                </div>
                <div className="sub-card text-center">
                  <p className="label-text mb-1">Availability</p>
                  <p className="font-medium text-[#F0EBE1]">{remaining} / {event.capacity}</p>
                </div>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span className="label-text">{pct}% sold</span>
                  <span className="label-text">{remaining} remaining</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#2E2B27]">
                  <div
                    className="h-full rounded-full bg-[#3B82F6] transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <div className="divider" />

              {/* Privacy explanation */}
              <div className="sub-card grid gap-3">
                <p className="label-text">How private ticketing works</p>
                <ol className="grid gap-2 text-sm text-[#7A7570]">
                  <li>
                    <span className="text-[#F0EBE1]">1. Pay privately</span> — use ENSPay stealth payments to buy your ticket. Your wallet address is never linked to this event on-chain.
                  </li>
                  <li>
                    <span className="text-[#F0EBE1]">2. Receive a secret</span> — you get a one-time random secret. Only its hash (commitment) is stored server-side. No identity, no wallet address.
                  </li>
                  <li>
                    <span className="text-[#F0EBE1]">3. Enter with QR</span> — show your QR at the door. The organizer verifies the commitment. Valid or invalid — that's all they learn.
                  </li>
                </ol>
              </div>

              {ticketError && <p className="text-sm text-[#EF4444]">{ticketError}</p>}

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  className="btn btn-primary"
                  onClick={getTicket}
                  disabled={getting || soldOut}
                >
                  {getting ? "Issuing ticket..." : soldOut ? "Sold Out" : "Get Private Ticket"}
                </button>
                <Link
                  href={`/?ens=${encodeURIComponent(event.organizer)}`}
                  className="btn btn-secondary text-center"
                >
                  Pay via ENSPay
                </Link>
              </div>
            </div>

            {/* Organizer verify panel */}
            <div className="card">
              <h3 className="section-title mb-3">Verify Tickets at Entry</h3>
              <p className="text-sm text-[#7A7570] mb-4">
                Are you the event organizer? Paste a secret from a QR scan to verify entry without learning who the attendee is.
              </p>
              <VerifyPanel />
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

function VerifyPanel() {
  const [secret, setSecret] = useState("");
  const [result, setResult] = useState<{ valid: boolean; reason?: string; eventTitle?: string } | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function verify() {
    if (!secret.trim()) return;
    setVerifying(true);
    setResult(null);
    try {
      const res = await fetch("/api/verify-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: secret.trim() }),
      });
      const data = await res.json() as { valid: boolean; reason?: string; event?: { title: string } };
      setResult({ valid: data.valid, reason: data.reason, eventTitle: data.event?.title });
    } catch {
      setResult({ valid: false, reason: "network_error" });
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="grid gap-3">
      <label className="grid gap-1">
        <span className="label-text">Ticket Secret</span>
        <input
          className="input font-mono text-xs"
          placeholder="Paste secret from attendee's QR code..."
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
        />
      </label>
      <button className="btn btn-secondary" onClick={verify} disabled={verifying || !secret.trim()}>
        {verifying ? "Verifying..." : "Verify Ticket"}
      </button>
      {result && (
        <div className={`sub-card text-center ${result.valid ? "border-[#22C55E]" : "border-[#EF4444]"}`}>
          <p className="text-2xl">{result.valid ? "✅" : "❌"}</p>
          <p className={`font-medium mt-1 ${result.valid ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
            {result.valid ? "Valid Ticket" : "Invalid Ticket"}
          </p>
          {result.valid && result.eventTitle && (
            <p className="label-text mt-1">{result.eventTitle}</p>
          )}
          {!result.valid && result.reason === "already_used" && (
            <p className="label-text mt-1 text-[#EF4444]">Already used</p>
          )}
        </div>
      )}
    </div>
  );
}
