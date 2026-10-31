import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

export interface User {
  id: string;
  name: string;
  email: string;
}

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3000";

/**
 * The signed-in user, checked with the backend once per request. It reads the request's
 * cookies, so call it inside a <Suspense> boundary.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const response = await fetch(`${backendUrl}/api/auth/get-session`, {
    headers: { cookie: (await cookies()).toString() },
    cache: "no-store",
  });
  if (!response.ok) return null;

  const session = (await response.json()) as { user: User } | null;
  return session && { id: session.user.id, name: session.user.name, email: session.user.email };
});

/** Like getCurrentUser, but sends visitors who aren't signed in to /login, then back to `returnTo`. */
export async function requireUser(returnTo: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?redirect=${encodeURIComponent(returnTo)}`);
  return user;
}
