import type { NextApiRequest, NextApiResponse } from "next";
import { createEvent, listEvents } from "@/utils/eventStore";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    return res.status(200).json({ events: listEvents() });
  }

  if (req.method === "POST") {
    const { title, organizer, description, date, ticketPrice, capacity } = req.body as Record<string, unknown>;

    if (
      typeof title !== "string" || !title.trim() ||
      typeof organizer !== "string" || !organizer.trim() ||
      typeof description !== "string" ||
      typeof date !== "string" || !date ||
      typeof ticketPrice !== "number" || ticketPrice <= 0 ||
      typeof capacity !== "number" || capacity <= 0
    ) {
      return res.status(400).json({ error: "Missing or invalid fields." });
    }

    const event = createEvent({ title: title.trim(), organizer: organizer.trim(), description, date, ticketPrice, capacity });
    return res.status(201).json({ event });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ error: "Method not allowed" });
}
