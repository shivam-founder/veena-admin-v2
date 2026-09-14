const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}

const supabase = require("@supabase/supabase-js").createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  if (!checkAuthWrapper(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const { title, body } = req.body || {};
  if (!title || !body) {
    return res.status(400).json({ error: "title aur body zaroori" });
  }

  try {
    const snap = await supabase.from("fcm_tokens").select("token");
    const tokens = (snap.data || []).map((r) => r.token).filter(Boolean);

    if (tokens.length === 0) {
      return res.status(200).json({ sent: 0, failed: 0, message: "Koi device registered nahi" });
    }

    const message = {
      notification: { title, body },
      tokens: tokens.slice(0, 500),
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    return res.status(200).json({
      sent: response.successCount,
      failed: response.failureCount,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Inline auth (kyunki _auth require ka path same folder me hai)
const checkAuthWrapper = require("./_auth");
