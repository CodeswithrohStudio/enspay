import type { NextApiRequest, NextApiResponse } from "next";
import { getEvent } from "@/utils/eventStore";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = typeof req.query.id === "string" ? req.query.id : "";
  const event = getEvent(id);

  if (!event) {
    return res.status(404).json({ error: "Event not found" });
  }

  return res.status(200).json({ event });
}
