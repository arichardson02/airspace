"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Plane } from "lucide-react";
import { Counter } from "@/components/counter";
import { usePhases } from "@/lib/use-phases";
import { cn } from "@/lib/utils";

// The five Tour scenes, each a page of the app that plays through its states while
// `active` and then holds. Remount one to replay it from the start.

const ease = [0.22, 1, 0.36, 1] as const;

/** Longest scene plus a pause, so a stage can show each one in full. */
export const SCENE_MS = 8000;

// Something that appears once a phase is reached.
function At({
  phase,
  when,
  children,
  className,
  delay = 0,
}: {
  phase: number;
  when: number;
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <AnimatePresence initial={false}>
      {phase >= when && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease, delay }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Bar({ to, duration = 1 }: { to: number; duration?: number }) {
  return (
    <div className="h-1 overflow-hidden rounded-full bg-paper/15">
      <motion.div
        animate={{ scaleX: to }}
        transition={{ duration, ease }}
        className="h-full origin-left rounded-full bg-paper"
      />
    </div>
  );
}

function Live() {
  return (
    <span className="relative flex size-1.5 shrink-0">
      <span className="absolute inset-0 animate-ping rounded-full bg-paper/70" />
      <span className="relative size-1.5 rounded-full bg-paper" />
    </span>
  );
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl bg-paper/6 px-4 py-3", className)}>{children}</div>;
}

function Title({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between">
      <h4 className="display text-xl">{children}</h4>
      {aside && <span className="text-xs text-paper/50">{aside}</span>}
    </div>
  );
}

// 1. Download the setup, install it, and the tray app finds the sim. Mirrors what the
// connector does: it signs in, waits for SimConnect, says hello, then streams position.
const installPhases = [1600, 1800, 1500, 1300] as const;

export function InstallScene({ active }: { active: boolean }) {
  const phase = usePhases(active, installPhases);

  return (
    <>
      <Title aside="Windows 10 and 11">Download</Title>
      <Panel>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">airspace-connector-setup.exe</span>
          <span className="text-xs text-paper/60">
            {phase === 0 ? (
              <>
                <Counter value={active ? 4.2 : 0} decimals={1} /> of 4.2 MB
              </>
            ) : (
              "Downloaded"
            )}
          </span>
        </div>
        <div className="mt-2.5">
          <Bar to={active ? 1 : 0} duration={1.5} />
        </div>
      </Panel>

      <At phase={phase} when={1} className="mt-3">
        <Panel>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Airspace Connector Setup</span>
            <span className="text-xs text-paper/60">{phase >= 2 ? "Installed" : "Installing…"}</span>
          </div>
          <div className="mt-2.5">
            <Bar to={phase >= 1 ? 1 : 0} duration={1.6} />
          </div>
          <At phase={phase} when={2}>
            <ul className="mt-3 flex flex-col gap-1.5 text-xs text-paper/70">
              {["Added to startup", "Runs in the system tray"].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="size-3" strokeWidth={3} />
                  {item}
                </li>
              ))}
            </ul>
          </At>
        </Panel>
      </At>

      <At phase={phase} when={2} className="mt-3">
        <Panel className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Airspace Connector</p>
            <p className="text-xs text-paper/60">Signed in as Cam</p>
          </div>
          <span className="flex items-center gap-2 text-xs">
            {phase >= 3 ? <Live /> : <span className="size-1.5 rounded-full bg-paper/40" />}
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={phase >= 4 ? "sending" : phase >= 3 ? "connected" : "waiting"}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
              >
                {phase >= 4
                  ? "Sending position · 4 msg/s"
                  : phase >= 3
                    ? "Connected to MSFS 2024"
                    : "Waiting for the simulator"}
              </motion.span>
            </AnimatePresence>
          </span>
        </Panel>
      </At>
    </>
  );
}

// 2. The board at your airport: filter, pick a job, accept it, the plan is ready.
const jobPhases = [1400, 1300, 1400] as const;
const jobs = [
  { route: "KSEA → KPDX", detail: "48 passengers · CRJ-700", pay: "$4,200", xp: "180 XP" },
  { route: "KSEA → KBFI", detail: "1,200 lb cargo · C208", pay: "$1,650", xp: "90 XP" },
  { route: "KSEA → KGEG", detail: "110 passengers · A320neo", pay: "$7,800", xp: "310 XP" },
];

export function JobScene({ active }: { active: boolean }) {
  const phase = usePhases(active, jobPhases);

  return (
    <>
      <Title aside="12 available">Jobs at KSEA</Title>
      <div className="flex gap-1.5 text-xs">
        {["All", "Passengers", "Cargo"].map((filter, index) => (
          <span
            key={filter}
            className={cn("rounded-full px-2.5 py-1", index === 0 ? "bg-paper text-ink" : "bg-paper/8 text-paper/60")}
          >
            {filter}
          </span>
        ))}
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {jobs.map((job, index) => {
          const picked = index === 0 && phase >= 1;
          return (
            <li
              key={job.route}
              className={cn(
                "flex items-center justify-between rounded-xl px-4 py-3 transition-colors duration-300",
                picked ? "bg-paper/10 ring-1 ring-paper/40" : "bg-paper/6",
              )}
            >
              <div>
                <p className="text-sm font-medium">{job.route}</p>
                <p className="text-xs text-paper/50">{job.detail}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium tabular-nums">{job.pay}</p>
                  <p className="text-xs text-paper/50">{job.xp}</p>
                </div>
                {picked && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 22 }}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      phase >= 2 ? "bg-paper text-ink" : "border border-paper/40",
                    )}
                  >
                    {phase >= 2 ? "Accepted" : "Accept"}
                  </motion.span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <At phase={phase} when={3} className="mt-3">
        <Panel className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
          <span className="font-medium">Flight plan ready</span>
          <span className="text-paper/60">128 nm</span>
          <span className="text-paper/60">Est. 0:52</span>
          <span className="text-paper/60">FL240</span>
          <span className="text-paper/60">Gate B4</span>
        </Panel>
      </At>
    </>
  );
}

// 3. Taxi, take off, climb, cruise. The route fills as the flight goes.
const flyPhases = [1400, 1400, 1600, 2000] as const;
const flight = [
  { stage: "Taxi", progress: 0.04, altitude: 430, speed: 18, vs: 0 },
  { stage: "Takeoff", progress: 0.1, altitude: 1200, speed: 150, vs: 1800 },
  { stage: "Climb", progress: 0.32, altitude: 14000, speed: 290, vs: 2200 },
  { stage: "Cruise", progress: 0.58, altitude: 24000, speed: 412, vs: 0 },
  { stage: "Cruise", progress: 0.66, altitude: 24000, speed: 414, vs: 0 },
];

export function FlyScene({ active }: { active: boolean }) {
  const phase = usePhases(active, flyPhases);
  const now = flight[Math.min(phase, flight.length - 1)];

  return (
    <>
      <Title
        aside={
          <span className="flex items-center gap-2">
            <Live />
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={now.stage}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.3 }}
              >
                {now.stage}
              </motion.span>
            </AnimatePresence>
          </span>
        }
      >
        KSEA → KPDX
      </Title>
      <p className="-mt-3 text-xs text-paper/50">CRJ-700 · 48 passengers · Job 1284</p>

      <div className="relative mt-8 h-6">
        <div className="absolute inset-x-0 top-1/2 h-px bg-paper/20" />
        <motion.div
          animate={{ scaleX: active ? now.progress : 0 }}
          transition={{ duration: 1.2, ease }}
          className="absolute inset-x-0 top-1/2 h-px origin-left bg-paper"
        />
        <motion.span
          animate={{ left: `${(active ? now.progress : 0) * 100}%` }}
          transition={{ duration: 1.2, ease }}
          className="absolute top-1/2 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-paper text-ink"
        >
          <Plane className="size-3 rotate-45" />
        </motion.span>
        <span className="absolute left-0 top-full mt-1 text-[10px] text-paper/50">KSEA</span>
        <span className="absolute right-0 top-full mt-1 text-[10px] text-paper/50">KPDX</span>
      </div>

      <dl className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Altitude", <Counter key="alt" value={active ? now.altitude : 0} />, "ft"],
          ["Ground speed", <Counter key="gs" value={active ? now.speed : 0} />, "kts"],
          ["Heading", "161", "°"],
          ["Vertical speed", <Counter key="vs" value={active ? now.vs : 0} />, "fpm"],
        ].map(([label, value, unit]) => (
          <Panel key={label as string} className="py-2.5">
            <dt className="text-[10px] text-paper/50">{label}</dt>
            <dd className="mt-0.5 text-base font-medium">
              {value}
              <span className="ml-0.5 text-[10px] text-paper/50">{unit}</span>
            </dd>
          </Panel>
        ))}
      </dl>
    </>
  );
}

// 4. The debrief: landing graded, pay in, XP up, flight added to the logbook.
const rankPhases = [1200, 1200, 1300] as const;

export function RankScene({ active }: { active: boolean }) {
  const phase = usePhases(active, rankPhases);

  return (
    <>
      <Title aside="KSEA → KPDX · 0:52">Flight Complete</Title>
      <div className="grid grid-cols-2 gap-2">
        <Panel>
          <p className="text-[10px] text-paper/50">Landing</p>
          <p className="mt-0.5 text-xl font-semibold">
            <Counter value={active ? -138 : 0} />
            <span className="ml-1 text-xs font-medium text-paper/50">fpm</span>
          </p>
          <At phase={phase} when={1}>
            <p className="text-xs text-paper/60">Smooth · 1.12 G · 3rd in your club</p>
          </At>
        </Panel>
        <Panel>
          <p className="text-[10px] text-paper/50">Pay</p>
          <p className="mt-0.5 text-xl font-semibold">
            $<Counter value={phase >= 1 ? 4200 : 0} />
          </p>
          <At phase={phase} when={2}>
            <p className="text-xs text-paper/60">
              Balance $<Counter value={132650} />
            </p>
          </At>
        </Panel>
      </div>

      <Panel className="mt-2">
        <div className="flex justify-between text-xs">
          <span>First Officer</span>
          <span className="font-medium">
            +<Counter value={phase >= 2 ? 180 : 0} /> XP
          </span>
        </div>
        <div className="mt-2">
          <Bar to={phase >= 2 ? 0.66 : 0.58} />
        </div>
        <p className="mt-1.5 text-[10px] text-paper/50">
          <Counter value={phase >= 2 ? 1960 : 2140} /> XP to Captain
        </p>
      </Panel>

      <At phase={phase} when={3} className="mt-2">
        <div className="flex items-center justify-between rounded-xl bg-paper px-4 py-3 text-ink">
          <span className="text-sm font-medium">Added to your logbook</span>
          <span className="text-xs text-ink/60">Flight 284</span>
        </div>
      </At>
    </>
  );
}

// 5. The club: who is on, a message lands, you join the weekend flight.
const clubPhases = [1300, 1600, 1500] as const;
const online = [
  { name: "Mara K.", status: "EGLL → LFPG · A320neo" },
  { name: "Jonas", status: "KSEA → KPDX · CRJ-700" },
  { name: "Priya", status: "Parked at KSFO" },
];

export function ClubScene({ active }: { active: boolean }) {
  const phase = usePhases(active, clubPhases);

  return (
    <>
      <Title aside="24 pilots · 3 online">Pacific Northwest Club</Title>
      <ul className="flex flex-col gap-2">
        {online.map((pilot) => (
          <li key={pilot.name} className="flex items-center gap-2.5 text-sm">
            <span className="flex size-6 items-center justify-center rounded-full bg-paper/12 text-[10px] font-semibold">
              {pilot.name[0]}
            </span>
            <span className="font-medium">{pilot.name}</span>
            <span className="truncate text-xs text-paper/50">{pilot.status}</span>
            <Live />
          </li>
        ))}
      </ul>

      <At phase={phase} when={1} className="mt-4">
        <Panel className="flex gap-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-paper/12 text-[10px] font-semibold">
            M
          </span>
          <p className="text-sm leading-snug">
            <span className="font-medium">Mara K.</span>{" "}
            <span className="text-paper/80">Anchorage run Saturday, who&apos;s in?</span>
          </p>
        </Panel>
      </At>

      <At phase={phase} when={2} className="mt-2">
        <Panel className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-paper/50">Group Flight · Saturday 19:00 UTC</p>
            <p className="text-sm font-medium">KSEA → PANC</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-paper/60">
              <Counter value={phase >= 3 ? 9 : 8} /> going
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 font-medium transition-colors",
                phase >= 3 ? "bg-paper text-ink" : "border border-paper/40",
              )}
            >
              {phase >= 3 ? "Joined" : "Join"}
            </span>
          </div>
        </Panel>
      </At>
    </>
  );
}

export const steps = [
  {
    title: "Install the Connector",
    body: "A small Windows app that starts with the sim and talks to it through SimConnect.",
    url: "airspace.club/download",
    Scene: InstallScene,
  },
  {
    title: "Pick a Job",
    body: "Passenger or cargo, from the airport you are parked at. Accept one and the plan is ready.",
    url: "airspace.club/jobs",
    Scene: JobScene,
  },
  {
    title: "Fly",
    body: "Any aircraft, any ATC. Airspace follows the flight from pushback to shutdown.",
    url: "airspace.club/flights/live",
    Scene: FlyScene,
  },
  {
    title: "Rank Up",
    body: "The landing is graded, the pay lands, and the XP adds up toward the next rank.",
    url: "airspace.club/flights/1284",
    Scene: RankScene,
  },
  {
    title: "Fly With Your Club",
    body: "See who is on, talk in the club, and join the weekend group flight.",
    url: "airspace.club/club",
    Scene: ClubScene,
  },
];
