import type { ConnectorStatus } from "@fs-career/contracts";

export interface StatusStore {
  get(): ConnectorStatus;
  /** Replaces the given sections and tells every subscriber. */
  update(patch: Partial<Omit<ConnectorStatus, "version">>): void;
  /** Calls `listener` on every change; returns a function that stops it. */
  subscribe(listener: (status: ConnectorStatus) => void): () => void;
}

/** Everything the desktop window shows, owned by the connector except `update`, which the main process writes. */
export function createStatus(version: string): StatusStore {
  let status: ConnectorStatus = {
    version,
    account: { state: "checking" },
    sim: { state: "waiting" },
    coop: { state: "off" },
    update: { state: "none" },
  };
  const listeners = new Set<(status: ConnectorStatus) => void>();

  return {
    get: () => status,
    update(patch) {
      status = { ...status, ...patch };
      for (const listener of listeners) listener(status);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
