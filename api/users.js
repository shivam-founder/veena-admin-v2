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

  try {
    const db = admin.firestore();
    const list = await admin.auth().listUsers(1000);
    const users = [];

    for (const user of list.users) {
      // Likes count
      const likesSnap = await db.collection("users").doc(user.uid).collection("likes").get();
      // Playlists count
      const playlistsSnap = await db.collection("users").doc(user.uid).collection("playlists").get();

      users.push({
        uid: user.uid,
        email: user.email || "",
        name: user.displayName || "",
        created_at: user.metadata.creationTime,
        likes_count: likesSnap.size,
        playlists_count: playlistsSnap.size,
      });
    }

    // Newest first
    users.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return res.status(200).json({ users });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
