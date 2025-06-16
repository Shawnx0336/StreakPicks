import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Return user data without sensitive information
    return Response.json({
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return Response.json({ error: 'Authentication check failed' }, { status: 500 });
  }
}