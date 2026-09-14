export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const { password } = req.body || {};
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Galat password" });
  }

  res.setHeader(
    "Set-Cookie",
    `admin_session=${process.env.ADMIN_SESSION_TOKEN}; HttpOnly; Path=/; Secure; Max-Age=604800; SameSite=Lax`
  );
  return res.status(200).json({ ok: true });
}
