import { whopSdk } from "@/lib/whop-sdk";
import { headers } from "next/headers";

export async function GET() {
  try {
    const headersList = await headers();
    const { userId } = await whopSdk.verifyUserToken(headersList);
    
    if (!userId) {
      return Response.json({ error: 'No Whop user' }, { status: 401 });
    }
    
    const result = await whopSdk.users.getCurrentUser();
    return Response.json({
      id: result.user.id,
      username: result.user.username,
      email: result.user.email,
      name: result.user.name
    });
    
  } catch (error) {
    return Response.json({ error: 'Not a Whop user' }, { status: 401 });
  }
}
