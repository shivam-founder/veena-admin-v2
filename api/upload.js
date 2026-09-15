const { createClient } = require("@supabase/supabase-js");
const checkAuth = require("./_auth");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  if (!checkAuth(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const { fileName, fileType, fileBase64, folder } = req.body || {};

    if (!fileName || !fileBase64 || !folder) {
      return res.status(400).json({ error: "fileName, fileBase64, folder zaroori" });
    }
    if (folder !== "songs" && folder !== "images") {
      return res.status(400).json({ error: "folder 'songs' ya 'images' hona chahiye" });
    }

    const buffer = Buffer.from(fileBase64, "base64");

    // Size limits: song 25MB, image 5MB
    const maxBytes = folder === "songs" ? 25 * 1024 * 1024 : 5 * 1024 * 1024;
    if (buffer.length > maxBytes) {
      return res.status(400).json({ error: "File bahut badi hai!" });
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${folder}/${Date.now()}_${safeName}`;

    const { error } = await supabase.storage
      .from("veena-media")
      .upload(path, buffer, {
        contentType: fileType || "application/octet-stream",
      });

    if (error) return res.status(500).json({ error: error.message });

    const { data } = supabase.storage
      .from("veena-media")
      .getPublicUrl(path);

    return res.status(200).json({ url: data.publicUrl });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
