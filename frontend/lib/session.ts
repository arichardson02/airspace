import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

export interface User {
  id: string;
  name: string;
  email: string;
}

interface Session {
  user: User;
}

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:3000";

/** The backend's get-session body when the cookie names a live session; it sends null when it doesn't. */
function isSession(body: unknown): body is Session {
  if (typeof body !== "object" || body === null || !("user" in body)) return false;
  const { user } = body;
  return (
    typeof user === "object" &&
    user !== null &&
    "id" in user &&
    typeof user.id === "string" &&
    "name" in user &&
    typeof user.name === "string" &&
    "email" in user &&
    typeof user.email === "string"
  );
}

/**
 * The signed-in user, checked with the backend once per request. It reads the request's
 * cookies, so call it inside a <Suspense> boundary.
 */
const getCurrentUser = cache(async (): Promise<User | null> => {
  const response = await fetch(`${backendUrl}/api/auth/get-session`, {
    headers: { cookie: (await cookies()).toString() },
    cache: "no-store",
  });
  if (!response.ok) return null;

  const body: unknown = await response.json();
  if (!isSession(body)) return null;
  return { id: body.user.id, name: body.user.name, email: body.user.email };
});

/** Like getCurrentUser, but sends visitors who aren't signed in to /login, then back to `returnTo`. */
export async function requireUser(returnTo: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?redirect=${encodeURIComponent(returnTo)}`);
  return user;
}
