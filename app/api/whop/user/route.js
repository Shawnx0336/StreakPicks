import { whopApi } from "@/lib/whop-api";
import { headers } from "next/headers";

export async function GET() {
    try {
        const headersList = await headers();
        
        // Extract user from Whop headers
        const userData = await whopApi.users.getCurrentUser();
        
        return Response.json({
            id: userData.user.id,
            username: userData.user.username,
            name: userData.user.name,
            email: userData.user.email,
            profilePicture: userData.user.profilePicture,
            isWhopUser: true
        });
        
    } catch (error) {
        console.error('Whop API error:', error);
        return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }
}
