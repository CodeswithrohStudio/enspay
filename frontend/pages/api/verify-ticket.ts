import type { NextApiRequest, NextApiResponse } from "next";
import { verifyTicket, peekTicket } from "@/utils/eventStore";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { secret, peek } = req.body as { secret?: string; peek?: boolean };
  if (!secret || typeof secret !== "string") {
    return res.status(400).json({ error: "secret is required" });
  }

  // peek=true: check without consuming the ticket (for ticket display page)
  if (peek) {
    const info = peekTicket(secret);
    if (!info) return res.status(404).json({ valid: false, reason: "not_found" });
    return res.status(200).json({ valid: !info.used, event: info.event, used: info.used });
  }

  // Normal verify: consumes the ticket (marks as used) — call only at event entry
  const result = verifyTicket(secret);

  if (!result.valid) {
    return res.status(200).json({
      valid: false,
      reason: result.reason,
    });
  }

  // Only return event metadata — never the payer's identity
  return res.status(200).json({
    valid: true,
    event: {
      id: result.event.id,
      title: result.event.title,
      date: result.event.date,
      organizer: result.event.organizer,
    },
  });
}
