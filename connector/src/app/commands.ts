import type { ConnectorCommand } from "@fs-career/contracts";

/** Checks a command that arrived from the desktop window; anything malformed is undefined. */
export function toCommand(value: unknown): ConnectorCommand | undefined {
  if (typeof value !== "object" || value === null) return undefined;

  const command = value as { type?: unknown; groupCode?: unknown };
  switch (command.type) {
    case "open-sign-in":
    case "retry-sign-in":
    case "sign-out":
    case "leave-group":
      return { type: command.type };
    case "join-group":
      return typeof command.groupCode === "string" ? { type: "join-group", groupCode: command.groupCode } : undefined;
    default:
      return undefined;
  }
}
