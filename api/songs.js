const { createClient } = require("@supabase/supabase-js");
const checkAuth = require("./_auth");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  if (!checkAuth(req, res)) return;

  // GET — saare songs (album ke saath)
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("songs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ songs: data });
  }

  // POST — naya song
  if (req.method === "POST") {
    const { title, artist, album, url, image_url, album_id } = req.body || {};
    if (!title || !artist || !url) {
      return res.status(400).json({ error: "title, artist, url zaroori" });
    }
    const { data, error } = await supabase
      .from("songs")
      .insert([{ title, artist, album: album || "", url, image_url: image_url || null, album_id: album_id || null }])
      .select();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ song: data[0] });
  }

  // PUT — song edit
  if (req.method === "PUT") {
    const { id, ...updates } = req.body || {};
    if (!id) return res.status(400).json({ error: "id zaroori" });
    const { data, error } = await supabase
      .from("songs")
      .update(updates)
      .eq("id", id)
      .select();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ song: data[0] });
  }

  // DELETE — song hatao
  if (req.method === "DELETE") {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: "id zaroori" });
    const { error } = await supabase
      .from("songs")
      .delete()
      .eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
