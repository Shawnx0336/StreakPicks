// app/api/whop/user/route.js - PROPER WHOP INTEGRATION

import { WhopAPI } from "@whop-apps/sdk";
import { headers } from "next/headers";

export async function GET(request) {
    try {
        // Get headers from Next.js
        const headersList = await headers();
        
        // Use WhopAPI with headers to get current user
        const currentUser = await WhopAPI.me({ headers: headersList }).GET("/me", {});
        
        if (!currentUser.data) {
            console.log('❌ No user data from Whop API');
            return Response.json({ error: 'Not authenticated' }, { status: 401 });
        }

        console.log('✅ Whop user authenticated:', currentUser.data.username);
        
        // Return the user data
        return Response.json({
            id: currentUser.data.id,
            username: currentUser.data.username,
            name: currentUser.data.name,
            email: currentUser.data.email,
            profilePicture: currentUser.data.profile_picture,
            bio: currentUser.data.bio,
            createdAt: currentUser.data.created_at,
            isWhopUser: true
        });
        
    } catch (error) {
        console.error('❌ Whop API error:', error);
        
        // Check if it's an authentication error
        if (error.status === 401 || error.message?.includes('unauthorized')) {
            return Response.json({ error: 'Not authenticated' }, { status: 401 });
        }
        
        return Response.json({ error: 'Failed to fetch user data' }, { status: 500 });
    }
}

// Alternative method using company API
export async function POST(request) {
    try {
        const body = await request.json();
        const { userId } = body;
        
        if (!userId) {
            return Response.json({ error: 'User ID required' }, { status: 400 });
        }

        // Use company API to get user info
        const userInfo = await WhopAPI.company().GET("/company/users/{id}", {
            params: { path: { id: userId } }
        });
        
        return Response.json({
            id: userInfo.data.id,
            username: userInfo.data.username,
            name: userInfo.data.name,
            email: userInfo.data.email,
            isWhopUser: true
        });
        
    } catch (error) {
        console.error('❌ Whop API POST error:', error);
        return Response.json({ error: 'Failed to fetch user data' }, { status: 500 });
    }
}
