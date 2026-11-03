import type { ReactElement } from "react";
import type { CoopStatus, Pilot } from "@fs-career/contracts";
import { Beam, Cockpit } from "@fs-career/ui/instruments";
import { firstName, StatCard } from "@fs-career/ui/shell";

interface CardCopy {
  value: string;
  detail: string;
}

function copy(pilot: Pilot, coop: CoopStatus): CardCopy {
  switch (coop.state) {
    case "joined":
      return {
        value:
          coop.peers.length > 0
            ? `Flying with ${coop.peers.map(({ name }) => name).join(", ")}`
            : "Waiting for Your Co-pilot",
        detail: coop.flyer === pilot.id ? "You have control" : "Your co-pilot has control",
      };
    case "joining":
      return { value: "Joining", detail: coop.groupCode };
    case "off":
      break;
  }
  return { value: "Fly Together", detail: "Join a group with a code" };
}

interface CoopCardProps {
  pilot: Pilot;
  coop: CoopStatus;
  className?: string;
  index?: number;
  size?: "md" | "lg";
  /** Makes the card a button, with an arrow after its label. */
  onClick?: () => void;
}

/** The co-op card, drawn the same on Home and on the Co-op page: who is in the cockpit and who has control. */
export function CoopCard({ pilot, coop, className, index, size, onClick }: CoopCardProps): ReactElement {
  const joined = coop.state === "joined";
  const youFly = joined && coop.flyer === pilot.id;
  const peer = joined ? coop.peers[0] : undefined;
  const { value, detail } = copy(pilot, coop);

  return (
    <StatCard
      index={index}
      size={size}
      className={className}
      label={joined ? `Co-op · ${coop.groupCode}` : "Co-op"}
      value={value}
      detail={detail}
      onClick={onClick}
      background={<Beam />}
      art={
        <Cockpit
          seats={[
            { name: firstName(pilot.name), flying: youFly },
            { name: peer !== undefined ? firstName(peer.name) : "Co-pilot", flying: joined && !youFly },
          ]}
        />
      }
    />
  );
}
