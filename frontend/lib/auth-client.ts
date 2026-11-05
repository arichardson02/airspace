import { createAuthClient } from "better-auth/react";
import { deviceAuthorizationClient, inferAdditionalFields } from "better-auth/client/plugins";

// The backend serves auth on this same origin (App Platform routes /api to it; in dev
// next.config.ts rewrites /api there), so the session cookie is first-party.
export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [
    deviceAuthorizationClient(),
    // The backend's extra user fields (backend/src/auth/auth.ts), so updateUser accepts them.
    inferAdditionalFields({ user: { simbriefPilotId: { type: "string", required: false } } }),
  ],
});
