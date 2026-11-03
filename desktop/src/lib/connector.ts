import { useEffect, useState } from "react";
import type { ConnectorCommand, ConnectorStatus } from "@fs-career/contracts";

/** What electron/preload.ts exposes to the page. */
interface AirspaceBridge {
  status(): Promise<ConnectorStatus>;
  onStatus(listener: (status: ConnectorStatus) => void): () => void;
  send(command: ConnectorCommand): void;
  minimize(): void;
  close(): void;
}

declare global {
  interface Window {
    airspace: AirspaceBridge;
  }
}

export const bridge = (): AirspaceBridge => window.airspace;

/** The connector's latest status, or undefined until the first one arrives. */
export function useConnector(): ConnectorStatus | undefined {
  const [status, setStatus] = useState<ConnectorStatus>();

  useEffect(() => {
    const stop = bridge().onStatus(setStatus);
    // A status pushed while this was loading wins over the initial fetch.
    async function loadInitial(): Promise<void> {
      const initial = await bridge().status();
      setStatus((current) => current ?? initial);
    }
    void loadInitial();
    return stop;
  }, []);

  return status;
}

export const send = (command: ConnectorCommand): void => {
  bridge().send(command);
};

/** Shows device codes the way the website's approval page does, e.g. ABCD-2345. */
export const formatCode = (code: string): string => (code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code);
