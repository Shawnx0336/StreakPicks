import { whopApi } from "@/lib/whop-api";
import { headers } from "next/headers";

export async function GET(request) {
    try {
        const headersList = await headers();
        
        // Extract the user ID from Whop headers
        const { userId } = await verifyUserToken(headersList);
        
        if (!userId) {
            return Response.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Load the user's profile information using Whop API
        const userData = await whopApi.users.getCurrentUser();
        
        // Return the user data
        return Response.json({
            id: userData.user.id,
            username: userData.user.username,
            name: userData.user.name,
            email: userData.user.email,
            profilePicture: userData.user.profilePicture,
            bio: userData.user.bio,
            createdAt: userData.user.createdAt,
            isWhopUser: true
        });
        
    } catch (error) {
        console.error('Whop API error:', error);
        return Response.json({ error: 'Failed to fetch user' }, { status: 500 });
    }
}
*/
