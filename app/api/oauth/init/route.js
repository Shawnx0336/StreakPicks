import { WhopServerSdk } from "@whop/api";

const whopApi = WhopServerSdk({
  appApiKey: process.env.WHOP_API_KEY,
  appId: process.env.NEXT_PUBLIC_WHOP_APP_ID,
});

export function GET(request) {
  console.log('🔍 OAuth init called');
  
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "/";

  try {
    const { url: authUrl, state } = whopApi.oauth.getAuthorizationUrl({
      redirectUri: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/oauth/callback`,
      scope: ["read_user"],
    });

    console.log('🔍 Generated auth URL:', authUrl);
    console.log('🔍 Generated state:', state);

    // Fix: Remove Secure flag for localhost
    const isLocalhost = request.url.includes('localhost');
    const cookieOptions = isLocalhost 
      ? `oauth-state.${state}=${encodeURIComponent(next)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`
      : `oauth-state.${state}=${encodeURIComponent(next)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600`;

    return new Response(null, {
      status: 302,
      headers: {
        "Location": authUrl,
        "Set-Cookie": cookieOptions,
      },
    });
  } catch (error) {
    console.error('🚨 OAuth init error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}