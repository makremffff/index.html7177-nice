import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const { action, userID, ref } = req.query;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  if (action === "openBox") {
    const { data, error } = await supabase.rpc("open_box_atomic", {
      p_user_id: userID
    });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, reward: data });
  }

  return res.status(400).json({ error: "Invalid action" });
}