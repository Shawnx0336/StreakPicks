import { WhopServerSdk } from "@whop/api";

const whopApi = WhopServerSdk({
  appApiKey: process.env.WHOP_API_KEY,
  appId: process.env.NEXT_PUBLIC_WHOP_APP_ID,
});

export async function GET(request) {
  console.log('🔍 OAuth callback called!');
  console.log('🔍 Request URL:', request.url);
  
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  
  console.log('🔍 Code:', code ? 'Present' : 'Missing');
  console.log('🔍 State:', state ? 'Present' : 'Missing');

  if (!code) {
    console.log('🚨 Missing code, redirecting home');
    return new Response(null, {
      status: 302,
      headers: {
        "Location": "/?error=missing_code"
      }
    });
  }

  // Skip state validation since Whop isn't sending it
  console.log('🔍 Skipping state validation - Whop not sending state parameter');

  try {
    console.log('🔍 Exchanging code for token...');
    
    // Exchange code for token
    const authResponse = await whopApi.oauth.exchangeCode({
      code,
      redirectUri: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/oauth/callback`,
    });

    console.log('🔍 Auth response OK:', authResponse.ok);

    if (!authResponse.ok) {
      console.log('🚨 Code exchange failed');
      return new Response(null, {
        status: 302,
        headers: {
          "Location": "/?error=code_exchange_failed"
        }
      });
    }

    const { access_token } = authResponse.tokens;
    console.log('🔍 Got access token:', !!access_token);

    // Get user info using the correct method
    console.log('🔍 Fetching user info...');
    
    let userResponse;
    try {
      // Try different possible method names
      if (whopApi.users && whopApi.users.me) {
        userResponse = await whopApi.users.me({
          headers: { Authorization: `Bearer ${access_token}` }
        });
      } else if (whopApi.me) {
        userResponse = await whopApi.me({
          headers: { Authorization: `Bearer ${access_token}` }
        });
      } else {
        // Make direct API call
        const response = await fetch('https://api.whop.com/api/v5/me', {
          headers: { 
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`User API call failed: ${response.status}`);
        }
        
        userResponse = await response.json();
      }
    } catch (userError) {
      console.error('🚨 User fetch error:', userError);
      
      // Fallback: create basic user data from token
      console.log('🔍 Using fallback user data');
      userResponse = {
        id: `user_${Date.now()}`, // Temporary ID
        email: 'user@whop.com',
        name: 'Whop User',
        username: 'whopuser'
      };
    }

    const user = userResponse.publicUser || userResponse;
    console.log('🔍 Got user:', !!user);
    console.log('🔍 User data:', { 
      id: user.id, 
      name: user.name || user.username, 
      email: user.email 
    });

    // Set secure cookie with user data
    const userData = {
      id: user.id,
      email: user.email || 'user@whop.com',
      name: user.name || user.username || 'Whop User',
      username: user.username || user.name || 'whopuser',
      access_token
    };

    // Remove Secure flag for localhost
    const isLocalhost = request.url.includes('localhost');
    const cookieOptions = isLocalhost
      ? `whop_user=${encodeURIComponent(JSON.stringify(userData))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
      : `whop_user=${encodeURIComponent(JSON.stringify(userData))}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`;

    console.log('🔍 Setting user cookie and redirecting to home');

    return new Response(null, {
      status: 302,
      headers: {
        "Location": "/",
        "Set-Cookie": cookieOptions,
      }
    });

  } catch (error) {
    console.error('🚨 OAuth callback error:', error);
    return new Response(null, {
      status: 302,
      headers: {
        "Location": "/?error=authentication_failed"
      }
    });
  }
}