import { useEffect, useState } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";
import type { Event } from "@/utils/eventStore";

function EventCard({ event }: { event: Event }) {
  const remaining = event.capacity - event.ticketsSold;
  const pct = Math.round((event.ticketsSold / event.capacity) * 100);

  return (
    <Link href={`/event/${event.id}`} className="sub-card block transition-colors hover:border-[#3B82F6]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="ens-title truncate">{event.title}</h3>
          <p className="label-text mt-1">{event.organizer}</p>
        </div>
        <div className="shrink-0 text-right">
          <span className="ens-title text-[#3B82F6]">${event.ticketPrice}</span>
          <p className="label-text">USDC</p>
        </div>
      </div>

      <p className="mt-3 text-sm text-[#7A7570] line-clamp-2">{event.description}</p>

      <div className="mt-4 grid gap-2">
        <div className="flex items-center justify-between">
          <span className="label-text">{event.ticketsSold} / {event.capacity} tickets sold</span>
          <span className="label-text">{remaining} left</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#2E2B27]">
          <div
            className="h-full rounded-full bg-[#3B82F6] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="label-text">{event.date}</span>
        <span className="badge badge-blue">Get Private Ticket →</span>
      </div>
    </Link>
  );
}

type CreateForm = {
  title: string;
  organizer: string;
  description: string;
  date: string;
  ticketPrice: string;
  capacity: string;
};

const emptyForm: CreateForm = {
  title: "",
  organizer: "",
  description: "",
  date: "",
  ticketPrice: "50",
  capacity: "100",
};

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function fetchEvents() {
    setLoading(true);
    try {
      const res = await fetch("/api/events");
      const data = await res.json() as { events: Event[] };
      setEvents(data.events);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchEvents();
  }, []);

  async function createEvent() {
    setCreateError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          organizer: form.organizer,
          description: form.description,
          date: form.date,
          ticketPrice: parseFloat(form.ticketPrice),
          capacity: parseInt(form.capacity, 10),
        }),
      });
      const data = await res.json() as { event?: Event; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to create event");
      setForm(emptyForm);
      setShowCreate(false);
      await fetchEvents();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setCreating(false);
    }
  }

  function field(key: keyof CreateForm, label: string, type = "text", placeholder = "") {
    return (
      <label key={key} className="grid gap-1">
        <span className="label-text">{label}</span>
        <input
          type={type}
          className="input"
          placeholder={placeholder}
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        />
      </label>
    );
  }

  return (
    <Layout title="Private Events" wide>
      <div className="grid gap-6">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <p className="label-text max-w-md">
            Pay for event tickets privately via ENSPay stealth payments — prove eligibility at the door without revealing your wallet.
          </p>
          <button
            className="btn btn-primary shrink-0"
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? "Cancel" : "+ Create Event"}
          </button>
        </div>

        {/* Privacy explainer */}
        <div className="sub-card grid gap-3 sm:grid-cols-3">
          {[
            { icon: "💸", title: "Pay Privately", desc: "Buy tickets via ENSPay stealth — payment can't be linked to your identity" },
            { icon: "🎟️", title: "Private Ticket", desc: "Receive a secret. Only the hash is stored — your wallet address is never recorded" },
            { icon: "🔐", title: "Prove at Entry", desc: "Scan your QR at the door. Organizer sees only valid/invalid — never who you are" },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="grid gap-1">
              <div className="text-2xl">{icon}</div>
              <p className="font-medium text-[#F0EBE1]">{title}</p>
              <p className="text-sm text-[#7A7570]">{desc}</p>
            </div>
          ))}
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="card grid gap-4">
            <h2 className="section-title">Create Event</h2>
            {field("title", "Event Title", "text", "ETH Denver After-Party")}
            {field("organizer", "Organizer ENS or Address", "text", "alice.eth")}
            <label className="grid gap-1">
              <span className="label-text">Description</span>
              <textarea
                className="input min-h-[72px]"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            {field("date", "Event Date", "date")}
            <div className="grid gap-4 sm:grid-cols-2">
              {field("ticketPrice", "Ticket Price (USDC)", "number", "50")}
              {field("capacity", "Capacity", "number", "100")}
            </div>
            {createError && <p className="text-sm text-[#EF4444]">{createError}</p>}
            <button
              className="btn btn-primary"
              onClick={createEvent}
              disabled={creating || !form.title || !form.organizer || !form.date}
            >
              {creating ? "Creating..." : "Create Event"}
            </button>
          </div>
        )}

        {/* Events list */}
        {loading && (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-36 w-full rounded-[8px]" />)}
          </div>
        )}

        {!loading && events.length === 0 && (
          <div className="sub-card text-center text-[#7A7570]">No events yet. Create one above.</div>
        )}

        {!loading && events.length > 0 && (
          <div className="grid gap-4">
            {events.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        )}
      </div>
    </Layout>
  );
}
