// pages/api/index.ts
import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import pino from "pino";

const logger = pino({ level: process.env.LOG_LEVEL || "info" });

// استخدم service_role لأننا في الخادم
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

type BoxReward = { success: true; reward: number };
type WaitRes   = { error: "wait"; wait: number };
type ErrorRes  = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BoxReward | WaitRes | ErrorRes>
) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { action, userID, ref } = req.query as Record<string, string | undefined>;

  /* ---------- 1. Validation ---------- */
  if (!action || !userID) return res.status(400).json({ error: "Missing parameters" });
  if (!/^[a-zA-Z0-9_-]{3,64}$/.test(userID)) return res.status(400).json({ error: "Invalid userID" });

  try {
    switch (action) {
      case "openBox": {
        const reward = await openBoxTx(userID);
        if ("wait" in reward) return res.status(429).json(reward);
        return res.status(200).json(reward);
      }

      default:
        return res.status(400).json({ error: "Invalid action" });
    }
  } catch (e: any) {
    logger.error({ err: e, userID, action }, "Unhandled error");
    return res.status(500).json({ error: "Internal server error" });
  }
}

/* ---------- 2. Transactional Box ---------- */
async function openBoxTx(uid: string): Promise<BoxReward | WaitRes> {
  return supabase.rpc("open_box_atomic", { p_user_id: uid }).then((r) => {
    if (r.error) {
      if (r.error.message.includes("wait")) {
        const left = Number(r.error.message.split(" ")[1]);
        return { error: "wait", wait: left };
      }
      throw r.error;
    }
    return { success: true, reward: r.data };
  });
}
