import { motion } from "framer-motion";
import { ArrowRight, Gauge, Users } from "lucide-react";
import type { ConnectorStatus, Pilot } from "@fs-career/contracts";
import { ActionButton } from "@fs-career/ui/button";
import { Card, Pill } from "../components/card";
import { rise } from "../lib/motion";

// SimConnect reports the simulator by its internal codename.
const simNames: Record<string, string> = { KittyHawk: "Microsoft Flight Simulator 2020" };

interface HomeProps {
  pilot: Pilot;
  status: ConnectorStatus;
  onOpenCoop: () => void;
}

export function Home({ pilot, status, onOpenCoop }: HomeProps) {
  const { sim, coop } = status;
  const firstName = pilot.name.split(" ")[0];

  return (
    <div className="px-10 py-10">
      <motion.h1 {...rise(0)} className="display text-4xl">
        Welcome back, {firstName}.
      </motion.h1>
      <motion.p {...rise(0.1)} className="mt-3 max-w-lg leading-relaxed text-paper/60">
        Keep Airspace open while you fly. It finds Microsoft Flight Simulator by itself.
      </motion.p>

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <motion.div {...rise(0.2)}>
          <Card className="h-full">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2.5 text-[15px] font-medium">
                <Gauge className="size-4 text-paper/60" />
                Simulator
              </h2>
              {sim.state === "connected" ? <Pill strong>Connected</Pill> : <Pill live>Waiting</Pill>}
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-paper/55">
              {sim.state === "connected"
                ? `${simNames[sim.name] ?? sim.name} is running. Airspace is connected and ready.`
                : "Waiting for Microsoft Flight Simulator. Start it and Airspace connects on its own."}
            </p>
          </Card>
        </motion.div>

        <motion.div {...rise(0.28)}>
          <Card className="h-full">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2.5 text-[15px] font-medium">
                <Users className="size-4 text-paper/60" />
                Co-op
              </h2>
              {coop.state === "joined" ? (
                <Pill strong>Group {coop.groupCode}</Pill>
              ) : coop.state === "joining" ? (
                <Pill live>Joining</Pill>
              ) : (
                <Pill>Not in a group</Pill>
              )}
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-paper/55">
              {coop.state === "joined"
                ? coop.peers.length > 0
                  ? `Flying with ${coop.peers.map((peer) => peer.name).join(", ")}.`
                  : "Waiting for your co-pilot to join with the same code."
                : "Fly a shared cockpit with a friend: pilot and co-pilot in the same aircraft."}
            </p>
            <ActionButton variant="ghost" size="sm" onClick={onOpenCoop} className="mt-5">
              {coop.state === "off" ? "Join a group" : "Open co-op"}
              <ArrowRight className="size-4" />
            </ActionButton>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
