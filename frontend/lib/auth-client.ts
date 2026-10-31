import { createAuthClient } from "better-auth/react";
import { deviceAuthorizationClient } from "better-auth/client/plugins";

// The backend serves auth on this same origin (App Platform routes /api to it; in dev
// next.config.ts rewrites /api there), so the session cookie is first-party.
export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [deviceAuthorizationClient()],
});
