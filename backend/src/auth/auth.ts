import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth, type Auth as BetterAuth, type BetterAuthOptions } from "better-auth";
import { bearer, deviceAuthorization } from "better-auth/plugins";
import type { Database } from "../database/database.module.js";
import { authSchema } from "./auth.schema.js";
import type { SendEmail } from "./email.js";

/** The only client allowed to sign in with a device code. */
const CONNECTOR_CLIENT_ID = "airspace-connector";

const DAY_SECONDS = 24 * 60 * 60;

export interface AuthConfig {
  /** The public origin the browser sees, e.g. https://airspace.club. */
  baseURL: string;
  secret: string;
  sendEmail: SendEmail;
}

export function createAuth(db: Database, config: AuthConfig): Auth {
  return betterAuth(authOptions(db, config));
}

// Kept apart from createAuth so Auth can be named from the options' inferred type, which carries the
// plugins' endpoints into authService.api.
function authOptions(db: Database, { baseURL, secret, sendEmail }: AuthConfig) {
  const { hostname } = new URL(baseURL);

  return {
    baseURL,
    basePath: "/api/auth",
    secret,
    // The site is also served on www.<domain>.
    trustedOrigins: hostname === "localhost" ? [] : [`https://www.${hostname}`],
    database: drizzleAdapter(db, { provider: "pg", schema: authSchema, usePlural: true }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        sendEmail({
          to: user.email,
          subject: "Reset your Airspace password",
          text: "Someone asked to reset the password for your Airspace account. If it was you, choose a new one here. Otherwise you can ignore this email.",
          link: url,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        sendEmail({
          to: user.email,
          subject: "Verify your Airspace email",
          text: `Welcome to Airspace, ${user.name}. Confirm your email to finish creating your account.`,
          link: url,
        });
      },
    },
    session: {
      // Each use after a day pushes expiry out again, so a connector in regular use stays signed in.
      expiresIn: 30 * DAY_SECONDS,
      updateAge: DAY_SECONDS,
    },
    advanced: {
      // App Platform's edge sets this to the real client IP; X-Forwarded-For can be spoofed.
      ipAddress: { ipAddressHeaders: ["do-connecting-ip"] },
    },
    plugins: [
      // Lets the connector send its session token as `Authorization: Bearer`.
      bearer(),
      deviceAuthorization({
        verificationUri: "/device",
        validateClient: (clientId) => clientId === CONNECTOR_CLIENT_ID,
      }),
    ],
  } satisfies BetterAuthOptions;
}

export type Auth = BetterAuth<ReturnType<typeof authOptions>>;
