import { cookies } from 'next/headers';

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const userCookie = cookieStore.get('whop_user');
  
  if (!userCookie) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(userCookie.value));
  } catch (error) {
    console.error('Error parsing user cookie:', error);
    return null;
  }
}

export async function verifyUserToken(headersList) {
  const user = await getCurrentUser();
  return user ? { userId: user.id, user } : { userId: null, user: null };
}