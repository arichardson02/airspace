import type { ReactElement } from "react";
import { Minus, X } from "lucide-react";
import { Mark } from "@fs-career/ui/mark";
import { bridge } from "../lib/connector";

// The window has no system frame; this bar moves it and holds its buttons, styled like the app windows on
// the marketing page.
export function TitleBar(): ReactElement {
  return (
    <header className="drag flex h-10 shrink-0 items-center justify-between border-b border-paper/10 pl-4">
      <div className="flex items-center gap-2 text-[13px] font-medium text-paper/70">
        <Mark className="h-3.5 w-auto" />
        Airspace
      </div>
      <div className="no-drag flex h-full">
        <button
          type="button"
          aria-label="Minimize"
          onClick={() => {
            bridge().minimize();
          }}
          className="grid w-12 place-items-center text-paper/55 transition-colors hover:bg-paper/8 hover:text-paper"
        >
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Close"
          onClick={() => {
            bridge().close();
          }}
          className="grid w-12 place-items-center text-paper/55 transition-colors hover:bg-paper hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>
    </header>
  );
}
