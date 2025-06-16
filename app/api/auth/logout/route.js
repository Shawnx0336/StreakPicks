export function POST() {
  return new Response(null, {
    status: 302,
    headers: {
      "Location": "/",
      "Set-Cookie": "whop_user=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    }
  });
}