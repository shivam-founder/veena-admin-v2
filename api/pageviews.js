const { createClient } = require("@supabase/supabase-js");
const checkAuth = require("./_auth");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  if (!checkAuth(req, res)) return;

  try {
    const { data, error } = await supabase
      .from("page_view_counts")
      .select("page_name, views, unique_users")
      .order("views", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ pages: data || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
