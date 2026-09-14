module.exports = async (req, res) => {
  res.setHeader("Set-Cookie", "admin_session=; HttpOnly; Path=/; Secure; Max-Age=0; SameSite=Lax");
  return res.status(200).json({ ok: true });
};
