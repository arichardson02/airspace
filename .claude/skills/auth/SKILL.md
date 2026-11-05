---
name: auth
description: How sign-in works across Airspace — Better Auth with email and password in our own database, email verification via Resend, website session cookies, requireUser() in the frontend, and the desktop/connector device-code flow with Bearer tokens. Use when touching login, signup, password reset, sessions, the /device approval page, credentials.json, or anything that checks who the user is.
---

# Auth (Better Auth, our own database)

- Email and password only, with email verification required. Resend sends from `no-reply@airspace.club`.
  Sessions last 30 days and renew daily.
- Backend side: `backend/src/auth/` (`auth.ts` config, `auth.schema.ts` tables, `email.ts` sender). A global
  guard protects every route; `@AllowAnonymous()` opts out, `@Session()` reads the user.
- **Website:** cookies on the site's own origin. In production the ingress routes `/api` to the backend; in
  development Next rewrites `/api/*` to it. Server components read the session through
  `frontend/lib/session.ts` (`requireUser()`), inside a `<Suspense>` boundary.
- **Desktop app and connector:** sign in with a device code. The app shows a code, the pilot approves it at
  `airspace.club/device`, and the connector gets a session token (client ID `airspace-connector`) that it
  sends as `Authorization: Bearer`. It's saved in `%APPDATA%\Airspace\credentials.json`. The connector side is
  `desktop/connector/auth/sign-in.ts`.
- Only the app pages need sign-in on the website. The marketing page stays public.
- Extra user fields are Better Auth `user.additionalFields` (`auth.ts`), columns on `users`, returned with the
  session and set through Better Auth's own `update-user`. `simbriefPilotId` (digits, `simbriefPilotIdSchema` in
  contracts) is set in the website's Settings; the connector reads it from the session for co-op.
