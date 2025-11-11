import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  const { action, userID, ref } = req.query;

  if (!action || !userID) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  // ✅ 1 — تأكد أن المستخدم موجود، وإن لم يوجد يتم إنشاؤه
  async function getOrCreateUser() {
    const { data: user } = await supabase
      .from("players")
      .select("*")
      .eq("user_id", userID)
      .single();

    if (user) return user;

    // ✅ Create new user
    const newUser = {
      user_id: userID,
      points: 0,
      usdt: 0,
      invited: 0,
      referrer: ref || null,
      lastbox: 0,
      lastbonus: 0,
    };

    await supabase.from("players").insert([newUser]);
    return newUser;
  }

  const user = await getOrCreateUser();

  // ✅ 2 — SYSTEM ACTIONS
  switch (action) {

    // ✅ Get Balance
    case "getBalance":
      return res.json({
        success: true,
        points: user.points,
        usdt: user.usdt,
        invited: user.invited,
        referrer: user.referrer,
      });

    // ✅ Open Box every 5 minutes
    case "openBox":
      const now = Date.now();
      const waitBox = now - user.lastbox;

      if (waitBox < 5 * 60 * 1000) {
        return res.json({
          error: "wait",
          wait: Math.ceil((5 * 60 * 1000 - waitBox) / 1000),
        });
      }

      const reward = Math.floor(Math.random() * 40) + 10;

      await supabase
        .from("players")
        .update({
          points: user.points + reward,
          lastbox: now,
        })
        .eq("user_id", userID);

      return res.json({ success: true, reward });

    // ✅ Bonus every 12 minutes
    case "bonus":
      const now2 = Date.now();
      const waitBonus = now2 - user.lastbonus;

      if (waitBonus < 12 * 60 * 1000) {
        return res.json({
          error: "wait",
          wait: Math.ceil((12 * 60 * 1000 - waitBonus) / 1000),
        });
      }

      const bonus = 200;

      await supabase
        .from("players")
        .update({
          points: user.points + bonus,
          lastbonus: now2,
        })
        .eq("user_id", userID);

      return res.json({ success: true, reward: bonus });

    // ✅ Referral Info
    case "refInfo":
      return res.json({
        success: true,
        invited: user.invited,
        referrer: user.referrer,
      });

    // ✅ Add referral manually
    case "addRef":
      if (!ref || ref === userID)
        return res.json({ error: "Invalid ref" });

      // update inviter
      await supabase.rpc("add_referral", {
        userid: userID,
        referrerid: ref,
      });

      return res.json({ success: true });

    // ✅ Withdraw
    case "withdraw":
      const { amount, address } = req.query;

      if (!amount || !address)
        return res.json({ error: "Missing params" });

      return res.json({
        success: true,
        message: "Withdrawal request sent",
      });

    default:
      return res.status(400).json({ error: "Invalid action" });
  }
}