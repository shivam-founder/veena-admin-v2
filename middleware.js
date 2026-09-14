export const config = {
  matcher: ["/app.html", "/api/:path*"],
};

export default function middleware(req) {
  const { pathname } = req.nextUrl;

  // Login API sabke liye open
  if (pathname === "/api/login") return;

  const token = req.cookies.get("admin_session")?.value;
  const valid = token && token === process.env.ADMIN_SESSION_TOKEN;

  if (valid) return;

  // API pe 401, page pe login redirect
  if (pathname.startsWith("/api/")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return Response.redirect(new URL("/", req.url));
}
