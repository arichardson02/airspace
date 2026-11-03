import type { ReactElement } from "react";
import type { ConnectorStatus, Pilot } from "@fs-career/contracts";
import { MapBackdrop } from "@fs-career/ui/map";
import { CardGrid, firstName, Page, StatCard } from "@fs-career/ui/shell";
import { CoopCard } from "../components/coop-card";
import { send } from "../lib/connector";

// SimConnect reports the simulator by its internal codename.
const simNames = new Map([["KittyHawk", "Microsoft Flight Simulator 2020"]]);
// Both cards stand the same height, as tall as fits the window without scrolling.
const CARD = "min-h-[190px] md:col-span-2";

interface HomeProps {
  pilot: Pilot;
  status: ConnectorStatus;
  onOpenCoop: () => void;
}

export function Home({ pilot, status, onOpenCoop }: HomeProps): ReactElement {
  const { sim, coop } = status;

  return (
    <Page
      title="Welcome back,"
      accent={firstName(pilot.name)}
      // The simulator's state is the page's status line, the simulator's name in full weight once connected.
      sub={
        sim.state === "connected" ? (
          <span>
            Connected to <span className="font-medium text-paper">{simNames.get(sim.name) ?? sim.name}</span>
          </span>
        ) : (
          "Start the simulator to connect"
        )
      }
    >
      {/* Two cards, both doors: the website first, since that is where the career lives, then Co-op here. */}
      <CardGrid>
        <StatCard
          className={CARD}
          label="On the Web"
          value="Your Career"
          detail="Opens airspace.club in your browser"
          onClick={() => {
            send({ type: "open-website" });
          }}
          external
          background={<MapBackdrop />}
        />
        <CoopCard index={1} className={CARD} pilot={pilot} coop={coop} onClick={onOpenCoop} />
      </CardGrid>
    </Page>
  );
}
