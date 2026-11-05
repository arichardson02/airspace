import type { ConnectorCommand } from "@fs-career/contracts";
import type { DeviceCode, Pilot, SignedIn } from "../auth/sign-in.js";
import type { BackendClient } from "../backend-client.js";
import type { Coop } from "../group/group-flight.js";
import type { StatusStore } from "./status.js";

type Backend = Pick<BackendClient, "start" | "stop" | "send">;

/** The parts of a SimConnect connection the controller uses. */
export interface SimHandle {
  on(event: "quit" | "close", listener: () => void): void;
  close(): void;
}

export interface SimConnection<H extends SimHandle = SimHandle> {
  name: string;
  versionMajor: number;
  versionMinor: number;
  handle: H;
}

export interface ConnectorDeps<H extends SimHandle = SimHandle> {
  status: StatusStore;
  /** How long to wait between attempts to reach the simulator. */
  simRetryMs: number;
  signIn(signal: AbortSignal, onCode: (code: DeviceCode) => void): Promise<SignedIn>;
  /** Forgets the saved sign-in. */
  signOut(): Promise<void>;
  /** The signed-in pilot as the backend has them now (settings changed on the website included). */
  currentPilot(token: string): Promise<Pilot | undefined>;
  openBrowser(url: string): void;
  /** The pilot's dashboard on the website. */
  dashboardUrl: string;
  /** Connects to the simulator; rejects while it isn't running. */
  openSim(): Promise<SimConnection<H>>;
  createBackend(token: string, onSignedOut: () => void): Backend;
  createCoop(handle: H): Coop;
}

/**
 * Runs the connector: keeps the pilot signed in, keeps reconnecting to the simulator, and joins and leaves
 * co-op groups on request. Everything it does shows up in `status`.
 */
export class Connector<H extends SimHandle = SimHandle> {
  private readonly status: StatusStore;
  private stopped = false;
  private signInAbort: AbortController | undefined;
  private verificationUrl: string | undefined;
  private signedIn: SignedIn | undefined;
  private backend: Backend | undefined;
  private sim: { connection: SimConnection<H>; coop?: Coop } | undefined;
  private group: { leave(): void } | undefined;
  // Bumped on every join and leave, so a join that finishes late can't revive a group that was left.
  private groupAttempt = 0;

  constructor(private readonly deps: ConnectorDeps<H>) {
    this.status = deps.status;
  }

  // fallow-ignore-next-line unused-class-member -- called by main.ts and the desktop app on the object createConnector() returns
  start(): void {
    this.signIn();
    this.connectSim();
  }

  // fallow-ignore-next-line unused-class-member -- called by main.ts and the desktop app on the object createConnector() returns
  async stop(): Promise<void> {
    this.stopped = true;
    this.signInAbort?.abort();
    this.leaveGroup();
    this.sim?.connection.handle.close();
    await this.backend?.stop();
  }

  // fallow-ignore-next-line unused-class-member -- the desktop app passes window commands here, via createConnector()
  handle(command: ConnectorCommand): void {
    switch (command.type) {
      case "open-sign-in":
        if (this.verificationUrl !== undefined && this.verificationUrl !== "") {
          this.deps.openBrowser(this.verificationUrl);
        }
        break;
      case "open-website":
        this.deps.openBrowser(this.deps.dashboardUrl);
        break;
      case "retry-sign-in":
        if (!this.signedIn) this.signIn();
        break;
      case "sign-out":
        void this.endSession();
        break;
      case "join-group":
        this.joinGroup(command.groupCode);
        break;
      case "leave-group":
        this.leaveGroup();
        break;
    }
  }

  private signIn(): void {
    this.signInAbort?.abort();
    const abort = new AbortController();
    this.signInAbort = abort;
    this.verificationUrl = undefined;
    this.status.update({ account: { state: "checking" } });

    const signingIn = this.deps.signIn(abort.signal, (code) => {
      this.verificationUrl = code.verificationUrl;
      this.status.update({ account: { state: "signing-in", ...code } });
    });
    void (async () => {
      try {
        const signedIn = await signingIn;
        if (abort.signal.aborted) return;
        this.signInAbort = undefined;
        this.onSignedIn(signedIn);
      } catch (err) {
        if (abort.signal.aborted) return;
        this.signInAbort = undefined;
        console.error("Sign-in failed:", err instanceof Error ? err.message : err);
        this.status.update({ account: { state: "error", message: signInError(err) } });
      }
    })();
  }

  private onSignedIn(signedIn: SignedIn): void {
    this.signedIn = signedIn;
    this.backend = this.deps.createBackend(signedIn.token, () => {
      console.error("Your sign-in is no longer valid; signing in again.");
      void this.endSession();
    });
    this.backend.start();
    console.log(`Signed in as ${signedIn.pilot.name} (${signedIn.pilot.email})`);
    this.status.update({ account: { state: "signed-in", pilot: signedIn.pilot } });

    if (this.sim) this.sendHello(this.sim.connection);
  }

  /** The pilot's SimBrief pilot ID, fetched again so one just set on the website counts. */
  private async simbriefPilotId(): Promise<string | null> {
    const { signedIn } = this;
    if (!signedIn) return null;
    const pilot = await this.deps.currentPilot(signedIn.token).catch(() => undefined);
    if (pilot && this.signedIn === signedIn) {
      this.signedIn = { ...signedIn, pilot };
      this.status.update({ account: { state: "signed-in", pilot } });
    }
    return (pilot ?? signedIn.pilot).simbriefPilotId;
  }

  /** Signs out, after the pilot asked to or the backend stopped accepting the session, and starts a new sign-in. */
  private async endSession(): Promise<void> {
    if (!this.signedIn) return;
    this.leaveGroup();
    const backend = this.backend;
    this.signedIn = undefined;
    this.backend = undefined;
    await backend?.stop();
    await this.deps.signOut();
    if (!this.stopped) this.signIn();
  }

  /** Tries to reach the simulator every `simRetryMs` until it's running. `announced` once the wait was logged. */
  private connectSim(announced = false): void {
    if (!this.stopped) void this.attemptSim(announced);
  }

  private async attemptSim(announced: boolean): Promise<void> {
    try {
      const connection = await this.deps.openSim();
      if (this.stopped) {
        connection.handle.close();
        return;
      }
      this.onSimConnected(connection);
    } catch (err) {
      if (!announced) {
        const refused = hasErrorCode(err) && err.code === "ECONNREFUSED";
        console.log(refused ? "Waiting for the simulator..." : `Waiting for the simulator (${String(err)})`);
      }
      setTimeout(() => {
        this.connectSim(true);
      }, this.deps.simRetryMs);
    }
  }

  private onSimConnected(connection: SimConnection<H>): void {
    this.sim = { connection };
    const disconnected = () => {
      this.onSimDisconnected(connection);
    };
    connection.handle.on("quit", disconnected);
    connection.handle.on("close", disconnected);

    const version = `${connection.versionMajor}.${connection.versionMinor}`;
    console.log(`Connected to ${connection.name} ${version}`);
    this.status.update({ sim: { state: "connected", name: connection.name, version } });

    // Position tracking (track/position-tracker.ts) is switched off for now.
    this.sendHello(connection);
  }

  private onSimDisconnected(connection: SimConnection<H>): void {
    // Quit and close both arrive when the simulator exits.
    if (this.sim?.connection !== connection) return;
    console.log("Simulator disconnected");
    this.sim = undefined;
    this.leaveGroup(this.group ? "The simulator closed" : undefined);
    this.status.update({ sim: { state: "waiting" } });
    this.connectSim();
  }

  private sendHello(connection: SimConnection<H>): void {
    this.backend?.send({
      type: "connector.hello",
      payload: {
        connectorVersion: this.status.get().version,
        sim: { name: connection.name, versionMajor: connection.versionMajor, versionMinor: connection.versionMinor },
      },
    });
  }

  private joinGroup(rawCode: string): void {
    const groupCode = rawCode.trim();
    const { signedIn, sim } = this;
    if (!groupCode || !signedIn || !sim || this.status.get().coop.state !== "off") {
      console.warn("Can't join a group right now: sign in and start the simulator first");
      return;
    }

    const attempt = ++this.groupAttempt;
    const current = () => attempt === this.groupAttempt;
    this.status.update({ coop: { state: "joining", groupCode } });
    sim.coop ??= this.deps.createCoop(sim.connection.handle);

    const joining = sim.coop.join({
      groupCode,
      token: signedIn.token,
      pilot: { pilotId: signedIn.pilot.id, name: signedIn.pilot.name },
      simbriefPilotId: () => this.simbriefPilotId(),
      onChange: (update) => {
        if (current()) this.status.update({ coop: { state: "joined", groupCode, ...update } });
      },
      onEnded: (reason) => {
        if (!current()) return;
        this.group = undefined;
        this.status.update({ coop: { state: "off", error: reason } });
      },
    });
    void (async () => {
      try {
        const group = await joining;
        if (current()) this.group = group;
        else group.leave();
      } catch (err) {
        if (!current()) return;
        const message = `Couldn't join group ${groupCode}: ${err instanceof Error ? err.message : String(err)}`;
        console.error(message);
        this.status.update({ coop: { state: "off", error: message } });
      }
    })();
  }

  private leaveGroup(error?: string): void {
    this.groupAttempt++;
    this.group?.leave();
    this.group = undefined;
    if (this.status.get().coop.state !== "off") {
      this.status.update({ coop: error === undefined ? { state: "off" } : { state: "off", error } });
    }
  }
}

function signInError(cause: unknown): string {
  // fetch rejects with a TypeError when the backend can't be reached at all.
  if (cause instanceof TypeError) return "Couldn't reach Airspace. Check your internet connection and try again.";
  return cause instanceof Error ? cause.message : String(cause);
}

/** Whether `err` carries a Node system error code, like the ECONNREFUSED of a simulator that isn't running. */
function hasErrorCode(err: unknown): err is { code: unknown } {
  return typeof err === "object" && err !== null && "code" in err;
}
