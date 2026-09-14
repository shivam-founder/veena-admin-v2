const admin = require("firebase-admin");
const checkAuth = require("./_auth");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}

module.exports = async (req, res) => {
  if (!checkAuth(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const { title, body } = req.body || {};
  if (!title || !body) {
    return res.status(400).json({ error: "title aur body zaroori" });
  }

  try {
    // Tokens FIRESTORE se (app wahan save karta hai)
    const db = admin.firestore();
    const snap = await db.collection("fcm_tokens").get();
    const tokens = snap.docs.map((d) => d.data().token).filter(Boolean);

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
