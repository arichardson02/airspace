"use client";

import type { ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Beam, Cockpit, Glow } from "@fs-career/ui/instruments";
import { MapBackdrop } from "@fs-career/ui/map";
import { CardGrid, firstName, Page, StatCard } from "@fs-career/ui/shell";

// Every card fills in from the connector's data. Until there is some, it says what will appear.
export function Dashboard({ name }: { name: string }): ReactElement {
  const router = useRouter();
  const dimmed = (
    <div className="size-full opacity-30">
      <Glow />
    </div>
  );

  return (
    <Page title="Welcome aboard," accent={firstName(name)} sub="Everything here fills in from your first flight.">
      <CardGrid>
        <StatCard
          size="lg"
          className="md:col-span-2"
          label="Live Map"
          value="Nobody flying"
          detail="Pilots show up here the moment they take off"
          onClick={() => {
            router.push("/app/map");
          }}
          background={<MapBackdrop />}
        />
        <StatCard
          index={1}
          size="lg"
          label="Co-op"
          value="No group"
          detail="Join from the desktop app"
          onClick={() => {
            router.push("/app/coop");
          }}
          background={<Beam />}
          art={
            <div className="size-full opacity-40">
              <Cockpit
                seats={[
                  { name: firstName(name), flying: false },
                  { name: "Co-pilot", flying: false },
                ]}
              />
            </div>
          }
        />
        <div className="grid gap-4">
          <StatCard
            index={2}
            label="Connector"
            value="Not connected"
            detail="Install the desktop app"
            onClick={() => {
              router.push("/app/settings");
            }}
            background={dimmed}
          />
          <StatCard
            index={3}
            label="Logbook"
            value="No flights yet"
            detail="Fills in as you fly"
            onClick={() => {
              router.push("/app/logbook");
            }}
            background={dimmed}
          />
        </div>
      </CardGrid>
    </Page>
  );
}
