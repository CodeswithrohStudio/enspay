import crypto from "crypto";

export type Event = {
  id: string;
  title: string;
  organizer: string; // ENS name or address
  description: string;
  date: string; // ISO date string
  ticketPrice: number; // in USDC
  capacity: number;
  ticketsSold: number;
  createdAt: number;
};

type Ticket = {
  commitment: string; // sha256(secret)
  eventId: string;
  issuedAt: number;
  used: boolean;
};

const events = new Map<string, Event>();
const tickets = new Map<string, Ticket>(); // commitment -> Ticket

function seedDemoEvents() {
  if (events.size > 0) return;
  const demos: Event[] = [
    {
      id: "evt_demo1",
      title: "ETH Denver After-Party",
      organizer: "vitalik.eth",
      description:
        "Exclusive after-party for ETH Denver attendees. Prove you have a ticket without revealing your wallet — powered by ENSPay private payments.",
      date: "2026-04-10",
      ticketPrice: 50,
      capacity: 100,
      ticketsSold: 23,
      createdAt: Date.now() - 86400000,
    },
    {
      id: "evt_demo2",
      title: "DeFi Builders Summit",
      organizer: "defidao.eth",
      description:
        "Summit for DeFi builders and researchers. Entry requires a private ticket — your identity is never revealed at the door.",
      date: "2026-05-02",
      ticketPrice: 100,
      capacity: 50,
      ticketsSold: 12,
      createdAt: Date.now() - 43200000,
    },
    {
      id: "evt_demo3",
      title: "ZK Proof Workshop",
      organizer: "zkresearch.eth",
      description:
        "Hands-on zero-knowledge proof workshop. Bring your laptop and your curiosity — leave your identity at home.",
      date: "2026-05-15",
      ticketPrice: 25,
      capacity: 30,
      ticketsSold: 8,
      createdAt: Date.now() - 3600000,
    },
  ];
  for (const e of demos) {
    events.set(e.id, e);
  }
}

seedDemoEvents();

export function listEvents(): Event[] {
  return Array.from(events.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function getEvent(id: string): Event | null {
  return events.get(id) ?? null;
}

export function createEvent(
  data: Omit<Event, "id" | "ticketsSold" | "createdAt">
): Event {
  const id = "evt_" + crypto.randomBytes(4).toString("hex");
  const event: Event = { ...data, id, ticketsSold: 0, createdAt: Date.now() };
  events.set(id, event);
  return event;
}

export type IssueTicketResult =
  | { ok: true; secret: string; commitment: string }
  | { ok: false; reason: "not_found" | "sold_out" };

export function issueTicket(eventId: string): IssueTicketResult {
  const event = events.get(eventId);
  if (!event) return { ok: false, reason: "not_found" };
  if (event.ticketsSold >= event.capacity) return { ok: false, reason: "sold_out" };

  const secret = crypto.randomBytes(32).toString("hex");
  const commitment = crypto.createHash("sha256").update(secret).digest("hex");

  tickets.set(commitment, { commitment, eventId, issuedAt: Date.now(), used: false });
  event.ticketsSold += 1;

  return { ok: true, secret, commitment };
}

export type VerifyTicketResult =
  | { valid: true; event: Event }
  | { valid: false; reason: "not_found" | "already_used" };

export function verifyTicket(secret: string): VerifyTicketResult {
  const commitment = crypto.createHash("sha256").update(secret).digest("hex");
  const ticket = tickets.get(commitment);

  if (!ticket) return { valid: false, reason: "not_found" };
  if (ticket.used) return { valid: false, reason: "already_used" };

  const event = events.get(ticket.eventId);
  if (!event) return { valid: false, reason: "not_found" };

  ticket.used = true;
  return { valid: true, event };
}

// Peek at ticket without consuming it (for display on ticket page)
export function peekTicket(secret: string): { event: Event; used: boolean } | null {
  const commitment = crypto.createHash("sha256").update(secret).digest("hex");
  const ticket = tickets.get(commitment);
  if (!ticket) return null;
  const event = events.get(ticket.eventId);
  if (!event) return null;
  return { event, used: ticket.used };
}
