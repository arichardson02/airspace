import { useState, ViewTransition, type ReactElement } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ReactLenis } from "lenis/react";
import { Home as HomeIcon, Users } from "lucide-react";
import type { ConnectorStatus, Pilot } from "@fs-career/contracts";
import { Intro, useIntroDone } from "@fs-career/ui/intro";
import { ease, screenTransition } from "@fs-career/ui/motion";
import { firstName, Sidebar, SidebarAccount, SidebarItem, SidebarSection } from "@fs-career/ui/shell";
import { TitleBar } from "./components/title-bar";
import { useConnector } from "./lib/connector";
import { Coop } from "./views/coop";
import { Home } from "./views/home";
import { Settings } from "./views/settings";
import { SignIn } from "./views/sign-in";

type View = "home" | "coop" | "settings";

// Settings opens from the gear beside the pilot's name, so it isn't in the menu.
const views = [
  { view: "home", label: "Home", icon: <HomeIcon /> },
  { view: "coop", label: "Co-op", icon: <Users /> },
] as const;

export function App(): ReactElement {
  const status = useConnector();
  // The screen starts as the opening curtain lifts.
  const ready = useIntroDone();

  return (
    <div className="relative flex h-full flex-col">
      <Intro />
      <TitleBar update={status?.update} />
      {/* Signing in or out swaps the screens as a view transition: one fades away as the other rises in. */}
      {ready &&
        status !== undefined &&
        (status.account.state === "signed-in" ? (
          <ViewTransition key="shell" {...screenTransition}>
            <Shell pilot={status.account.pilot} status={status} />
          </ViewTransition>
        ) : (
          <ViewTransition key="sign-in" {...screenTransition}>
            <SignIn account={status.account} />
          </ViewTransition>
        ))}
    </div>
  );
}

function Shell({ pilot, status }: { pilot: Pilot; status: ConnectorStatus }): ReactElement {
  const [view, setView] = useState<View>("home");
  const still = useReducedMotion();

  return (
    <div className="flex min-h-0 flex-1 pt-10">
      <Sidebar
        // One group, so no label; the padding drops Home well clear of the title bar.
        className="w-54 pt-4"
        account={
          <SidebarAccount
            name={firstName(pilot.name)}
            settingsActive={view === "settings"}
            onSettings={() => {
              setView("settings");
            }}
          />
        }
      >
        <SidebarSection>
          {views.map((item) => (
            <SidebarItem
              key={item.view}
              icon={item.icon}
              label={item.label}
              active={item.view === view}
              onClick={() => {
                setView(item.view);
              }}
            />
          ))}
        </SidebarSection>
      </Sidebar>

      {/* The page scrolls through Lenis, the same smooth scroll as the website, unless motion is reduced. */}
      <ReactLenis
        className="min-w-0 flex-1 overflow-y-auto"
        options={{ lerp: 0.12, autoRaf: true, smoothWheel: still !== true }}
      >
        <main>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease }}
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
              {view === "settings" && <Settings pilot={pilot} version={status.version} update={status.update} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </ReactLenis>
    </div>
  );
}
