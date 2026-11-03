import type { ReactElement } from "react";
import { Minus, X } from "lucide-react";
import { Logo } from "@fs-career/ui/logo";
import { bridge } from "../lib/connector";

// The window has no system frame; this bar moves it and holds its buttons. It floats over the screen so
// the screen centres on the whole window. The lockup is the same one the website's navbar uses.
export function TitleBar(): ReactElement {
  return (
    <header className="drag absolute inset-x-0 top-0 z-20 flex h-10 items-center justify-between border-b border-paper/10 bg-ink/60 pl-4 backdrop-blur-md">
      <Logo className="h-4" />
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
