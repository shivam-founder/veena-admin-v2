// Har protected API me ye check lagega
module.exports = function checkAuth(req, res) {
  const token = req.cookies.admin_session;
  if (!token || token !== process.env.ADMIN_SESSION_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
};
