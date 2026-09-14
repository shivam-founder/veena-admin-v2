const { createClient } = require("@supabase/supabase-js");
const checkAuth = require("./_auth");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  if (!checkAuth(req, res)) return;

  const { range } = req.query || {};
  const days = range === "30" ? 30 : 7;
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

  try {
    // ---- SONGS TRACKING (per-song listens in range) ----
    const { data: listens } = await supabase
      .from("song_listens")
      .select("song_id, user_id, listened_at")
      .gte("listened_at", since);

    // Saare songs lao (title/artist ke liye)
    const { data: allSongs } = await supabase
      .from("songs")
      .select("id, title, artist");

    const songMap = {};
    (allSongs || []).forEach((s) => (songMap[s.id] = s));

    // Song-wise aggregate
    const perSong = {};
    (listens || []).forEach((l) => {
      if (!perSong[l.song_id]) perSong[l.song_id] = { listens: 0, users: new Set() };
      perSong[l.song_id].listens++;
      perSong[l.song_id].users.add(l.user_id || "anon");
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

    // ---- USERS TRACKING ----
    const userMap = {};
    (listens || []).forEach((l) => {
      const uid = l.user_id || "anonymous";
      if (!userMap[uid]) userMap[uid] = { listens: 0, last: null };
      userMap[uid].listens++;
      if (!userMap[uid].last || l.listened_at > userMap[uid].last) {
        userMap[uid].last = l.listened_at;
      }
    });

    const userTracking = Object.entries(userMap)
      .map(([uid, d]) => ({
        user_id: uid,
        listens: d.listens,
        last_active: d.last,
        status: uid === "anonymous" ? "Guest" : "Registered",
      }))
      .sort((a, b) => b.listens - a.listens);

    return res.status(200).json({
      days,
      songTracking,
      userTracking,
      totals: {
        totalListens: (listens || []).length,
        activeUsers: Object.keys(userMap).length,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
