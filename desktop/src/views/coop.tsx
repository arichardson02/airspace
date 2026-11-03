import { useEffect, useState, type ReactElement, type SubmitEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Hand } from "lucide-react";
import type { ConnectorStatus, CoopStatus, Pilot } from "@fs-career/contracts";
import { ActionButton } from "@fs-career/ui/button";
import { Field, FormMessage } from "@fs-career/ui/field";
import { Avatar, Card, Pill } from "../components/card";
import { send } from "../lib/connector";
import { ease, rise } from "../lib/motion";

// How long the dual input warning stays up after the last time both pilots grabbed the controls.
const DUAL_INPUT_SHOWN_MS = 3_000;

export function Coop({ pilot, status }: { pilot: Pilot; status: ConnectorStatus }): ReactElement {
  const { coop, sim } = status;

  return (
    <div className="px-10 py-10">
      <motion.h1 {...rise(0)} className="display text-4xl">
        Co-op
      </motion.h1>
      <motion.p {...rise(0.1)} className="mt-3 max-w-lg leading-relaxed text-paper/60">
        Share one cockpit with a friend. Both of you enter the same group code; whoever moves their controls takes the
        aircraft.
      </motion.p>

      <motion.div {...rise(0.2)} className="mt-10 max-w-xl">
        {coop.state === "joined" ? (
          <Group pilot={pilot} coop={coop} />
        ) : (
          <JoinForm coop={coop} simConnected={sim.state === "connected"} />
        )}
      </motion.div>
    </div>
  );
}

function JoinForm({ coop, simConnected }: { coop: CoopStatus; simConnected: boolean }): ReactElement {
  const [code, setCode] = useState(coop.state === "joining" ? coop.groupCode : "");
  const joining = coop.state === "joining";

  function join(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    send({ type: "join-group", groupCode: code });
  }

  return (
    <Card>
      <form onSubmit={join} className="flex flex-col gap-5">
        <Field
          label="Group code"
          name="groupCode"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
          }}
          placeholder="Pick one and share it with your co-pilot"
          autoComplete="off"
          spellCheck={false}
          disabled={joining}
          className="select-text"
        />
        {coop.state === "off" && coop.error !== undefined && coop.error !== "" && (
          <FormMessage>{coop.error}</FormMessage>
        )}
        {!simConnected && (
          <FormMessage tone="info">Start Microsoft Flight Simulator and load a flight to join a group.</FormMessage>
        )}
        <ActionButton type="submit" variant="paper" disabled={!simConnected || joining || !code.trim()}>
          {joining ? "Joining…" : "Join group"}
          {!joining && <ArrowRight className="size-4" />}
        </ActionButton>
      </form>
    </Card>
  );
}

function Group({ pilot, coop }: { pilot: Pilot; coop: Extract<CoopStatus, { state: "joined" }> }): ReactElement {
  const youFly = coop.flyer === pilot.id;
  const flyerName = youFly ? "You" : (coop.peers.find((peer) => peer.pilotId === coop.flyer)?.name ?? "Your co-pilot");
  const dualInput = useRecent(coop.dualInputAt, DUAL_INPUT_SHOWN_MS);

  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence>
        {dualInput && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease }}
            className="flex items-center gap-3 rounded-xl bg-paper px-4 py-3 text-sm font-semibold text-ink"
          >
            <Hand className="size-4" />
            Dual input: you're both on the controls. The pilot flying keeps the aircraft.
          </motion.div>
        )}
      </AnimatePresence>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-paper/50">Group</p>
            <p className="mt-1 font-mono text-2xl font-medium tracking-[0.15em] select-text">{coop.groupCode}</p>
          </div>
          <Pill strong>{youFly ? "You have control" : `${flyerName} has control`}</Pill>
        </div>

        <ul className="mt-6 flex flex-col">
          <Member name={pilot.name} detail="You" flying={youFly} />
          {coop.peers.map((peer) => (
            <Member key={peer.pilotId} name={peer.name} detail="Co-pilot" flying={coop.flyer === peer.pilotId} />
          ))}
        </ul>
        {coop.peers.length === 0 && (
          <p className="mt-4 flex items-center gap-3 text-sm text-paper/55">
            <Pill live>Waiting</Pill>
            Your co-pilot joins with the same code.
          </p>
        )}

        <ActionButton
          variant="ghost"
          size="sm"
          onClick={() => {
            send({ type: "leave-group" });
          }}
          className="mt-6"
        >
          Leave group
        </ActionButton>
      </Card>
    </div>
  );
}

function Member({ name, detail, flying }: { name: string; detail: string; flying: boolean }): ReactElement {
  return (
    <li className="flex items-center gap-3 border-t border-paper/10 py-3.5">
      <Avatar name={name} inverted={!flying} />
      <div className="flex-1">
        <p className="text-[15px] font-medium">{name}</p>
        <p className="text-xs text-paper/50">{detail}</p>
      </div>
      {flying && <span className="text-xs font-medium text-paper/70">Flying</span>}
    </li>
  );
}

/** True while `at` is less than `forMs` ago. */
function useRecent(at: number | undefined, forMs: number): boolean {
  const [now, setNow] = useState(() => Date.now());
  const recent = at !== undefined && now - at < forMs;

  useEffect(() => {
    if (at === undefined) return undefined;
    setNow(Date.now());
    const timer = setTimeout(
      () => {
        setNow(Date.now());
      },
      Math.max(0, at + forMs - Date.now()),
    );
    return () => {
      clearTimeout(timer);
    };
  }, [at, forMs]);

  return recent;
}
