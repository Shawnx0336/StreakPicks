import { WhopApi } from "@whop/api";

// Initialize Whop API
const whopApi = WhopApi({
    appApiKey: process.env.WHOP_API_KEY ?? "",
});

export async function GET(request) {
    try {
        // Extract user ID from Whop headers
        const userId = request.headers.get('x-whop-user-id');
        const companyId = request.headers.get('x-whop-company-id');
        
        console.log('Whop headers:', { userId, companyId });
        
        if (!userId) {
            console.log('❌ No Whop user ID found in headers');
            return Response.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Create Whop API instance on behalf of the user
        const userWhopApi = WhopApi({
            appApiKey: process.env.WHOP_API_KEY ?? "",
            onBehalfOfUserId: userId,
            companyId: companyId || undefined,
        });

        // Fetch current user data
        const userData = await userWhopApi.users.getCurrentUser();
        
        console.log('✅ Whop user data fetched:', userData.user.username);
        
        // Return the user data
        return Response.json({
            id: userData.user.id,
            username: userData.user.username,
            name: userData.user.name,
            email: userData.user.email,
            profilePicture: userData.user.profilePicture,
            bio: userData.user.bio,
            createdAt: userData.user.createdAt,
            isWhopUser: true,
            companyId: companyId
        });
        
    } catch (error) {
        console.error('❌ Whop API error:', error);
        
        // Check if it's an authentication error
        if (error.message?.includes('unauthorized') || error.status === 401) {
            return Response.json({ error: 'Not authenticated' }, { status: 401 });
        }
        
        return Response.json({ error: 'Failed to fetch user data' }, { status: 500 });
    }
}
