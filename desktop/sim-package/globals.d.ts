// Globals of Flight Simulator's menu pages, where the loader and the menu code run: Coherent GT's bridge to the game,
// Asobo's menu flow and stored data (common.js), and the hand-off from the loader to the menu code.

declare const Coherent: { trigger(event: string, ...args: unknown[]): void };
declare function LaunchFlowEvent(eventName: string, ...args: unknown[]): void;
// The sim's stored data, where aircraft keep settings (the A32NX's SimBrief ID); readable from the main menu.
declare function GetStoredData(key: string): string | null;
declare function SetStoredData(key: string, value: string): void;
declare function DeleteStoredData(key: string): void;

interface Window {
  /** Defined by the menu code the app sends; the loader hands it its connection and page. */
  airspaceMenu?: (socket: WebSocket, page: string) => void;
}
