import type { NextApiRequest, NextApiResponse } from "next";
import { issueTicket } from "@/utils/eventStore";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { eventId } = req.body as { eventId?: string };
  if (!eventId || typeof eventId !== "string") {
    return res.status(400).json({ error: "eventId is required" });
  }

  const result = issueTicket(eventId);
  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 409;
    return res.status(status).json({ error: result.reason === "sold_out" ? "Event is sold out" : "Event not found" });
  }

  // Return the secret ONCE — it is never stored server-side in plaintext
  // Only the sha256 commitment is stored; identity is never linked to the ticket
  return res.status(201).json({ secret: result.secret });
}
