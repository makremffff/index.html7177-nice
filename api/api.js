import fs from "fs";
import path from "path";

export default function handler(req, res) {
  try {
    const { action, userID, amount, address, ref } = req.query;
    if (!action) return res.status(400).json({ error: "Missing action" });

    const filePath = path.join(process.cwd(), "players.json");

    // ✅ إنشاء ملف players.json إذا لم يوجد
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify({}), "utf8");
    }

    // ✅ قراءة اللاعبين
    let players = JSON.parse(fs.readFileSync(filePath, "utf8"));

    // ✅ تسجيل اللاعب إذا لم يكن موجود
    if (userID && !players[userID]) {
      players[userID] = {
        points: 0,
        usdt: 0,
        ref: null,
        invited: 0,
        lastBox: 0,
        lastBonus: 0,
      };

      // ✅ نظام الإحالات
      if (ref && ref !== userID) {
        if (players[ref]) {
          players[ref].invited++;
          players[ref].points += 5000;
        }
        players[userID].ref = ref;
      }

      fs.writeFileSync(filePath, JSON.stringify(players, null, 2));
    }

    // ✅ اللاعب الحالي
    const p = players[userID];

    // ✅ الأكشنات
    switch (action) {
      // ✅ جلب رصيد اللاعب
      case "getBalance":
        return res.json({
          points: p.points,
          usdt: p.usdt,
          invited: p.invited,
          lastBox: p.lastBox,
          lastBonus: p.lastBonus,
        });

      // ✅ فتح صندوق كل 5 دقائق
      case "openBox":
        if (Date.now() - p.lastBox < 5 * 60 * 1000) {
          return res.json({ error: "Wait 5 minutes" });
        }

        const rewardBox = Math.floor(Math.random() * (200 - 50 + 1)) + 50;
        p.points += rewardBox;
        p.lastBox = Date.now();
        fs.writeFileSync(filePath, JSON.stringify(players, null, 2));

        return res.json({ success: true, reward: rewardBox });

      // ✅ بونص كل 12 دقيقة
      case "bonus":
        if (Date.now() - p.lastBonus < 12 * 60 * 1000) {
          return res.json({ error: "Wait 12 minutes" });
        }

        p.points += 1000;
        p.lastBonus = Date.now();
        fs.writeFileSync(filePath, JSON.stringify(players, null, 2));

        return res.json({ success: true, reward: 1000 });

      // ✅ مشاهدة إعلان
      case "watchAd":
        p.points += 150;
        fs.writeFileSync(filePath, JSON.stringify(players, null, 2));
        return res.json({ success: true, reward: 150 });

      // ✅ إكمال مهمة
      case "claimTask":
        p.points += 10000;
        fs.writeFileSync(filePath, JSON.stringify(players, null, 2));
        return res.json({ success: true, reward: 10000 });

      // ✅ تحويل نقاط إلى USDT
      case "swap":
        const pts = parseInt(amount);
        if (!pts || pts < 10000)
          return res.status(400).json({ error: "Min 10,000 points" });

        const usdt = ((pts / 10000) * 0.005).toFixed(3);

        p.points -= pts;
        p.usdt += Number(usdt);
        fs.writeFileSync(filePath, JSON.stringify(players, null, 2));

        return res.json({ success: true, usdt });

      // ✅ طلب سحب
      case "withdraw":
        if (!amount || !address)
          return res.status(400).json({ error: "Missing params" });

        const telegramToken =
          "8222744961:AAE90Eehr8PqldV6oKxIS9Yo9hw69Zi83Us";
        const chatID = "8447940021";

        const msg = `🚨 New Withdrawal 🚨
👤 User: ${userID}
💰 Amount: ${amount} USDT
📍 Polygon Address: <code>${address}</code>
✅ Approve: <code>/approve ${address} ${amount}</code>
❌ Reject: <code>/reject ${address} ${amount}</code>`;

        fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatID,
            text: msg,
            parse_mode: "HTML",
          }),
        }).catch(() => {});

        return res.json({
          success: true,
          message: "Withdrawal request sent to admin!",
        });

      default:
        return res.status(400).json({ error: "Invalid action" });
    }
  } catch (e) {
    return res.status(500).json({ error: "Server crashed", details: e + "" });
  }
}