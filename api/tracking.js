const { createClient } = require("@supabase/supabase-js");
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

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Firebase users ka naam/email map banao (ek call me sab)
async function getUserMap() {
  try {
    const list = await admin.auth().listUsers(1000);
    const map = {};
    list.users.forEach((u) => {
      map[u.uid] = {
        name: u.displayName || "",
        email: u.email || "",
      };
    });
    return map;
  } catch (e) {
    return {};
  }
}

module.exports = async (req, res) => {
  if (!checkAuth(req, res)) return;

  const { range } = req.query || {};
  const days = range === "30" ? 30 : 7;
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

  try {
    const userMap = await getUserMap();   // 🆕 UID → naam/email map

    // ---- LISTENS (range me) ----
    const { data: listens } = await supabase
      .from("song_listens")
      .select("song_id, user_id, listened_at")
      .gte("listened_at", since);

    const { data: allSongs } = await supabase
      .from("songs")
      .select("id, title, artist");

    const songMap = {};
    (allSongs || []).forEach((s) => (songMap[s.id] = s));

    // ---- SONG TRACKING ----
    const perSong = {};
    (listens || []).forEach((l) => {
      if (!perSong[l.song_id]) perSong[l.song_id] = { listens: 0, users: new Set() };
      perSong[l.song_id].listens++;
      perSong[l.song_id].users.add(l.user_id || "anonymous");
    });

    const songTracking = Object.entries(perSong)
      .map(([songId, d]) => ({
        song_id: Number(songId),
        title: songMap[songId]?.title || "Unknown",
        artist: songMap[songId]?.artist || "",
        listens: d.listens,
        unique_listeners: d.users.size,
      }))
      .sort((a, b) => b.listens - a.listens);

    // ---- USER TRACKING (🆕 ab naam/email ke saath) ----
    const userMapCounts = {};
    (listens || []).forEach((l) => {
      const uid = l.user_id || "anonymous";
      if (!userMapCounts[uid]) userMapCounts[uid] = { listens: 0, last: null };
      userMapCounts[uid].listens++;
      if (!userMapCounts[uid].last || l.listened_at > userMapCounts[uid].last) {
        userMapCounts[uid].last = l.listened_at;
      }
    });

    const userTracking = Object.entries(userMapCounts)
      .map(([uid, d]) => {
        const info = userMap[uid];   // 🆕 Firebase se naam/email
        return {
          user_id: uid,
          name: info?.name || "",
          email: info?.email || "",
          listens: d.listens,
          last_active: d.last,
          status: uid === "anonymous" ? "Guest" : "Registered",
        };
      })
      .sort((a, b) => b.listens - a.listens);

    return res.status(200).json({
      days,
      songTracking,
      userTracking,
      totals: {
        totalListens: (listens || []).length,
        activeUsers: Object.keys(userMapCounts).length,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
