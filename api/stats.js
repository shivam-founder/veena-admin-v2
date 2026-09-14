const { createClient } = require("@supabase/supabase-js");
const checkAuth = require("./_auth");
const admin = require("firebase-admin");

// Firebase init (push notifications wale env vars reuse)
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

async function countAll(table) {
  const { count } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  return count || 0;
}

async function countSince(table, col, since) {
  const { count } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .gte(col, since);
  return count || 0;
}

// 7-day listens series (chart ke liye)
async function listens7dSeries() {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data } = await supabase
    .from("song_listens")
    .select("listened_at")
    .gte("listened_at", since);

  const days = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000);
    days[d.toISOString().slice(0, 10)] = 0;
  }
  (data || []).forEach((row) => {
    const day = row.listened_at.slice(0, 10);
    if (day in days) days[day]++;
  });
  return days;
}

// Top played songs (view se)
async function topPlayed(limit = 5) {
  const { data } = await supabase
    .from("song_listen_counts")
    .select("title, artist, listens, unique_listeners")
    .order("listens", { ascending: false })
    .limit(limit);
  return data || [];
}

// Top liked songs (Firestore — users/{uid}/likes aggregate)
async function topLiked(limit = 5) {
  try {
    const list = await admin.auth().listUsers(1000);
    const likeCounts = {};

    for (const user of list.users) {
      const snap = await admin
        .firestore()
        .collection("users")
        .doc(user.uid)
        .collection("likes")
        .get();
      snap.forEach((doc) => {
        const title = doc.data().title;
        if (title) likeCounts[title] = (likeCounts[title] || 0) + 1;
      });
    }

    return Object.entries(likeCounts)
      .map(([title, likes]) => ({ title, likes }))
      .sort((a, b) => b.likes - a.likes)
      .slice(0, limit);
  } catch (e) {
    return [];
  }
}

// Page views (view se)
async function pageViews() {
  const { data } = await supabase
    .from("page_view_counts")
    .select("page_name, views, unique_users")
    .order("views", { ascending: false });
  return data || [];
}

// Total users (Firebase Auth)
async function totalUsers() {
  const list = await admin.auth().listUsers(1000);
  return list.users.length;
}

module.exports = async (req, res) => {
  try {
    const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const [songs, listensAll, listens7d, users] = await Promise.all([
      countAll("songs"),
      countAll("song_listens"),
      countSince("song_listens", "listened_at", since7d),
      totalUsers(),
    ]);

    const [series, topPlayedSongs, topLikedSongs, pages] = await Promise.all([
      listens7dSeries(),
      topPlayed(5),
      topLiked(5),
      pageViews(),
    ]);

    return res.status(200).json({
      stats: { totalSongs: songs, totalUsers: users, listensAll, listens7d },
      series7d: series,
      topPlayed: topPlayedSongs,
      topLiked: topLikedSongs,
      pages,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
