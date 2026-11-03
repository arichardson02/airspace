import { useEffect, useState, type ReactElement, type SubmitEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Hand } from "lucide-react";
import type { ConnectorStatus, CoopStatus, Pilot } from "@fs-career/contracts";
import { ActionButton } from "@fs-career/ui/button";
import { Field, FormMessage } from "@fs-career/ui/field";
import { ease, rise } from "@fs-career/ui/motion";
import { Page, SettingsGroup, SettingsRow } from "@fs-career/ui/shell";
import { CoopCard } from "../components/coop-card";
import { send } from "../lib/connector";

// How long the dual input warning stays up after the last time both pilots grabbed the controls.
const DUAL_INPUT_SHOWN_MS = 3_000;

export function Coop({ pilot, status }: { pilot: Pilot; status: ConnectorStatus }): ReactElement {
  const { coop, sim } = status;

  return (
    <Page title="Co-op" sub="Enter the same group code as a friend. Whoever moves their controls flies.">
      <motion.div {...rise(0.16)} className="mt-7">
        {coop.state === "joined" ? (
          <Group pilot={pilot} coop={coop} />
        ) : (
          <JoinForm coop={coop} simConnected={sim.state === "connected"} />
        )}
      </motion.div>
    </Page>
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
    <div className="surface rounded-[18px] p-6">
      <form onSubmit={join} className="flex flex-col gap-5">
        <Field
          label="Group Code"
          name="groupCode"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
          }}
          placeholder="SKY123"
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
        <ActionButton type="submit" variant="paper" disabled={!simConnected || joining || code.trim() === ""}>
          {joining ? "Joining…" : "Join Group"}
          {!joining && <ArrowRight className="size-4" />}
        </ActionButton>
      </form>
    </div>
  );
}

function Group({ pilot, coop }: { pilot: Pilot; coop: Extract<CoopStatus, { state: "joined" }> }): ReactElement {
  const dualInput = useRecent(coop.dualInputAt, DUAL_INPUT_SHOWN_MS);

  return (
    <div className="flex flex-col gap-4">
      <CoopCard size="lg" pilot={pilot} coop={coop} />

      {coop.cockpit !== undefined && (
        <SettingsGroup title="Cockpit">
          <SettingsRow label={coop.cockpit.aircraft}>{coop.cockpit.synced ? "Synced" : "Motion only"}</SettingsRow>
          {coop.cockpit.notes.map((note) => (
            <SettingsRow key={note} label={note} />
          ))}
        </SettingsGroup>
      )}

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
            You're both on the controls. The pilot flying keeps the aircraft.
          </motion.div>
        )}
      </AnimatePresence>

      <ActionButton
        variant="ghost"
        size="sm"
        onClick={() => {
          send({ type: "leave-group" });
        }}
        className="self-start"
      >
        Leave group
      </ActionButton>
    </div>
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
