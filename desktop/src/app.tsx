import { useState, type ReactElement } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Home as HomeIcon, Settings as SettingsIcon, Users, type LucideIcon } from "lucide-react";
import type { ConnectorStatus, Pilot } from "@fs-career/contracts";
import { cn } from "@fs-career/ui/cn";
import { Avatar } from "./components/card";
import { TitleBar } from "./components/title-bar";
import { useConnector } from "./lib/connector";
import { ease } from "./lib/motion";
import { Coop } from "./views/coop";
import { Home } from "./views/home";
import { Settings } from "./views/settings";
import { SignIn } from "./views/sign-in";

type View = "home" | "coop" | "settings";

const nav: { view: View; label: string; icon: LucideIcon }[] = [
  { view: "home", label: "Home", icon: HomeIcon },
  { view: "coop", label: "Co-op", icon: Users },
  { view: "settings", label: "Settings", icon: SettingsIcon },
];

export function App(): ReactElement {
  const status = useConnector();

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      {!status ? null : status.account.state === "signed-in" ? (
        <Shell pilot={status.account.pilot} status={status} />
      ) : (
        <SignIn account={status.account} />
      )}
    </div>
  );
}

function Shell({ pilot, status }: { pilot: Pilot; status: ConnectorStatus }): ReactElement {
  const [view, setView] = useState<View>("home");

  return (
    <div className="flex min-h-0 flex-1">
      <nav className="flex w-56 shrink-0 flex-col border-r border-paper/10 p-3">
        <ul className="flex flex-col gap-1">
          {nav.map((item) => (
            <li key={item.view}>
              <button
                type="button"
                onClick={() => {
                  setView(item.view);
                }}
                aria-current={view === item.view ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  view === item.view
                    ? "bg-paper/10 font-medium text-paper"
                    : "text-paper/60 hover:bg-paper/6 hover:text-paper",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-auto flex items-center gap-2.5 rounded-lg px-2 py-2">
          <Avatar name={pilot.name} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">{pilot.name}</p>
            <p className="truncate text-xs text-paper/50">{pilot.email}</p>
          </div>
        </div>
      </nav>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease }}
          >
            {view === "home" && (
              <Home
                pilot={pilot}
                status={status}
                onOpenCoop={() => {
                  setView("coop");
                }}
              />
            )}
            {view === "coop" && <Coop pilot={pilot} status={status} />}
            {view === "settings" && <Settings pilot={pilot} version={status.version} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
