import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** The client ID the backend accepts for device sign-in. */
const CLIENT_ID = "airspace-connector";
const DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";
// The poll interval grows by this much when the backend says we're polling too fast (RFC 8628).
const SLOW_DOWN_MS = 5_000;

const credentialsFile = join(process.env.APPDATA ?? join(homedir(), ".config"), "Airspace", "credentials.json");

export interface Pilot {
  id: string;
  name: string;
  email: string;
}

export interface DeviceCode {
  /** The code the pilot checks on the website, e.g. ABCD2345. */
  userCode: string;
  /** The website page that approves this code, with the code filled in. */
  verificationUrl: string;
}

export interface SignInOptions {
  /** Called with the code to approve when there's no saved sign-in. */
  onCode: (code: DeviceCode) => void;
  signal?: AbortSignal;
}

/** The code was denied or expired; signing in again gets a new one. */
class DeviceCodeError extends Error {}

export interface SignedIn {
  /** A session token, sent as `Authorization: Bearer` to the backend. */
  token: string;
  pilot: Pilot;
}

/**
 * Signs in with the token saved by an earlier run, or else with a device code: the pilot approves
 * the code on the website and this polls until they do. The token is saved, so it's only asked once.
 */
export async function ensureSignedIn(backendUrl: string, options: SignInOptions): Promise<SignedIn> {
  const saved = await loadToken();
  if (saved !== undefined) {
    const pilot = await getPilot(backendUrl, saved, options.signal);
    if (pilot) return { token: saved, pilot };
    console.log("Your saved sign-in has expired.");
  }

  const token = await signInWithDeviceCode(backendUrl, options);
  const pilot = await getPilot(backendUrl, token, options.signal);
  if (!pilot) throw new Error("Signed in, but the backend didn't accept the new session");

  await saveToken(token);
  return { token, pilot };
}

/** Forgets the saved token, so the next run signs in again. */
export async function signOut(): Promise<void> {
  await rm(credentialsFile, { force: true });
}

/** The pilot the token belongs to, or undefined when the session is gone. Throws when the backend can't be reached. */
async function getPilot(backendUrl: string, token: string, signal?: AbortSignal): Promise<Pilot | undefined> {
  const response = await fetch(`${backendUrl}/auth/get-session`, {
    headers: { authorization: `Bearer ${token}` },
    signal,
  });
  if (response.status === 401) return undefined;
  if (!response.ok) throw new Error(`Checking the sign-in failed: HTTP ${response.status}`);

  const session: unknown = await response.json();
  if (session === null) return undefined;
  if (!isSession(session)) throw new Error("Checking the sign-in failed: the backend sent an unexpected response");
  return { id: session.user.id, name: session.user.name, email: session.user.email };
}

async function signInWithDeviceCode(backendUrl: string, { onCode, signal }: SignInOptions): Promise<string> {
  const code = await post(`${backendUrl}/auth/device/code`, { client_id: CLIENT_ID }, isDeviceAuthorization, signal);
  if (!code.ok) throw new Error(`Couldn't start sign-in: ${code.body.error_description ?? code.status}`);

  const { device_code, user_code, verification_uri_complete, expires_in } = code.body;
  onCode({ userCode: user_code, verificationUrl: verification_uri_complete });

  let intervalMs = code.body.interval * 1000;
  const expiresAt = Date.now() + expires_in * 1000;

  while (Date.now() < expiresAt) {
    // oxlint-disable-next-line no-await-in-loop -- RFC 8628 polling: one request per interval, never in parallel
    await sleep(intervalMs, signal);

    // oxlint-disable-next-line no-await-in-loop -- as above
    const token = await post(
      `${backendUrl}/auth/device/token`,
      { grant_type: DEVICE_GRANT, device_code, client_id: CLIENT_ID },
      isDeviceToken,
      signal,
    );
    if (token.ok) return token.body.access_token;

    switch (token.body.error) {
      case "authorization_pending":
        break;
      case "slow_down":
        intervalMs += SLOW_DOWN_MS;
        break;
      case "access_denied":
        throw new DeviceCodeError("Sign-in was denied on the website");
      case "expired_token":
        throw new DeviceCodeError("The sign-in code expired");
      case undefined:
      default:
        throw new Error(`Sign-in failed: ${token.body.error_description ?? token.body.error ?? token.status}`);
    }
  }
  throw new DeviceCodeError("The sign-in code expired");
}

/** Waits `ms`, or rejects with the abort reason as soon as `signal` aborts. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

/** The fields of the device sign-in requests (RFC 8628). */
interface OAuthRequest {
  client_id: string;
  grant_type?: string;
  device_code?: string;
}

type OAuthError = { error?: string; error_description?: string };

/** The backend's answer to a device-code request. */
interface DeviceAuthorization {
  device_code: string;
  user_code: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

interface DeviceToken {
  access_token: string;
}

/** Posts an OAuth request. `isBody` checks a successful response; a failed one carries an OAuth error. */
async function post<T>(
  url: string,
  body: OAuthRequest,
  isBody: (json: unknown) => json is T,
  signal?: AbortSignal,
): Promise<{ ok: true; status: number; body: T } | { ok: false; status: number; body: OAuthError }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const json: unknown = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false, status: response.status, body: isOAuthError(json) ? json : {} };
  if (!isBody(json)) throw new Error("Sign-in failed: the backend sent an unexpected response");
  return { ok: true, status: response.status, body: json };
}

export function openBrowser(url: string): void {
  if (process.platform !== "win32") return;
  // explorer.exe hands a URL to the default browser without cmd's quoting rules.
  spawn("explorer.exe", [url], { detached: true, stdio: "ignore" })
    .on("error", () => {})
    .unref();
}

async function loadToken(): Promise<string | undefined> {
  try {
    const saved: unknown = JSON.parse(await readFile(credentialsFile, "utf8"));
    // An empty token is no sign-in either.
    return isCredentials(saved) && saved.token !== "" ? saved.token : undefined;
  } catch {
    return undefined;
  }
}

async function saveToken(token: string): Promise<void> {
  await mkdir(dirname(credentialsFile), { recursive: true });
  await writeFile(credentialsFile, JSON.stringify({ token } satisfies Credentials), { mode: 0o600 });
}

/** What saveToken writes. */
interface Credentials {
  token: string;
}

// Everything below checks JSON from the backend or the credentials file before it's used.

function isCredentials(json: unknown): json is Credentials {
  return typeof json === "object" && json !== null && "token" in json && typeof json.token === "string";
}

function isSession(json: unknown): json is { user: Pilot } {
  return typeof json === "object" && json !== null && "user" in json && isPilot(json.user);
}

function isPilot(json: unknown): json is Pilot {
  return (
    typeof json === "object" &&
    json !== null &&
    "id" in json &&
    typeof json.id === "string" &&
    "name" in json &&
    typeof json.name === "string" &&
    "email" in json &&
    typeof json.email === "string"
  );
}

function isOAuthError(json: unknown): json is OAuthError {
  return (
    typeof json === "object" &&
    json !== null &&
    (!("error" in json) || typeof json.error === "string") &&
    (!("error_description" in json) || typeof json.error_description === "string")
  );
}

function isDeviceAuthorization(json: unknown): json is DeviceAuthorization {
  return (
    typeof json === "object" &&
    json !== null &&
    "device_code" in json &&
    typeof json.device_code === "string" &&
    "user_code" in json &&
    typeof json.user_code === "string" &&
    "verification_uri_complete" in json &&
    typeof json.verification_uri_complete === "string" &&
    "expires_in" in json &&
    typeof json.expires_in === "number" &&
    "interval" in json &&
    typeof json.interval === "number"
  );
}

function isDeviceToken(json: unknown): json is DeviceToken {
  return typeof json === "object" && json !== null && "access_token" in json && typeof json.access_token === "string";
}
