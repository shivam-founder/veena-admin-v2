const { createClient } = require("@supabase/supabase-js");
const checkAuth = require("./_auth");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  if (!checkAuth(req, res)) return;

  // GET — saare albums + unke songs count
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("albums")
      .select("*, songs(id)")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const albums = data.map((a) => ({
      ...a,
      song_count: a.songs ? a.songs.length : 0,
      songs: undefined
    }));
    return res.status(200).json({ albums });
  }

  // POST — naya album
  if (req.method === "POST") {
    const { name, cover_url } = req.body || {};
    if (!name) return res.status(400).json({ error: "name zaroori" });
    const { data, error } = await supabase
      .from("albums")
      .insert([{ name, cover_url: cover_url || null }])
      .select();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ album: data[0] });
  }

  // PUT — album edit
  if (req.method === "PUT") {
    const { id, name, cover_url } = req.body || {};
    if (!id) return res.status(400).json({ error: "id zaroori" });
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (cover_url !== undefined) updates.cover_url = cover_url;
    const { data, error } = await supabase
      .from("albums")
      .update(updates)
      .eq("id", id)
      .select();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ album: data[0] });
  }

  // DELETE
  if (req.method === "DELETE") {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: "id zaroori" });
    const { error } = await supabase
      .from("albums")
      .delete()
      .eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
