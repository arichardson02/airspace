import type { ReactElement } from "react";
import { Minus, X } from "lucide-react";
import type { UpdateStatus } from "@fs-career/contracts";
import { ActionButton } from "@fs-career/ui/button";
import { Logo } from "@fs-career/ui/logo";
import { bridge, send } from "../lib/connector";

// The window has no system frame; this bar moves it and holds its buttons. It floats over the screen so
// the screen centres on the whole window. The lockup is the same one the website's navbar uses. A downloaded
// update shows here, so it's seen on every screen, sign-in included.
export function TitleBar({ update }: { update: UpdateStatus | undefined }): ReactElement {
  return (
    <header className="drag absolute inset-x-0 top-0 z-20 flex h-10 items-center justify-between border-b border-paper/10 bg-ink/60 pl-4 backdrop-blur-md">
      <Logo className="h-4" />
      <div className="no-drag flex h-full items-center">
        {update?.state === "ready" && (
          <ActionButton
            variant="ghost"
            size="sm"
            onClick={() => {
              send({ type: "restart-to-update" });
            }}
            className="mr-2 h-7 px-3 text-xs"
          >
            Restart to Update
          </ActionButton>
        )}
        <button
          type="button"
          aria-label="Minimize"
          onClick={() => {
            bridge().minimize();
          }}
          className="grid h-full w-12 place-items-center text-paper/55 transition-colors hover:bg-paper/8 hover:text-paper"
        >
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Close"
          onClick={() => {
            bridge().close();
          }}
          className="grid h-full w-12 place-items-center text-paper/55 transition-colors hover:bg-paper hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>
    </header>
  );
}
