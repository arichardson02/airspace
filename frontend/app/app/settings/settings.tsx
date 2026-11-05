"use client";

import { useState, type ReactElement, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { ActionButton, buttonClass } from "@fs-career/ui/button";
import { FormMessage } from "@fs-career/ui/field";
import { AccountHeader, Page, SettingsGroup, SettingsRow } from "@fs-career/ui/shell";
import { siteConfig } from "@/config/site";
import { authClient } from "@/lib/auth-client";

// Mirrors the connector's sign-in: it opens /device with its code and the pilot approves it.
const connectSteps = [
  { title: "Download the desktop app", body: "A small Windows app for Microsoft Flight Simulator 2020" },
  { title: "Start it with the sim open", body: "It finds the simulator by itself" },
  { title: "Approve its code", body: "It opens airspace.club/device once, then stays signed in" },
];

// A SimBrief pilot ID is the number on the pilot's SimBrief account page (the backend checks the same).
const SIMBRIEF_PILOT_ID = /^\d{1,10}$/;

export function SettingsPage({
  name,
  email,
  simbriefPilotId,
}: {
  name: string;
  email: string;
  simbriefPilotId: string | null;
}): ReactElement {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <Page title="Settings" className="max-w-3xl">
      <AccountHeader
        name={name}
        email={email}
        action={
          <ActionButton
            variant="ghost"
            size="sm"
            onClick={() => {
              void signOut();
            }}
          >
            <LogOut className="size-4" />
            Sign Out
          </ActionButton>
        }
      />

      <SimBriefSettings saved={simbriefPilotId} />

      <SettingsGroup title="Connect Your Sim">
        {connectSteps.map((step, index) => (
          <SettingsRow key={step.title} label={step.title} detail={step.body}>
            {index === 0 ? (
              <a href={siteConfig.desktopDownload} className={buttonClass("paper", "sm")}>
                Download
              </a>
            ) : (
              <span className="text-paper/35 tabular-nums">0{index + 1}</span>
            )}
          </SettingsRow>
        ))}
      </SettingsGroup>
    </Page>
  );
}

/** The pilot's SimBrief pilot ID: in co-op, the co-pilot's flight plan uplink loads the captain's plan with it. */
function SimBriefSettings({ saved }: { saved: string | null }): ReactElement {
  const router = useRouter();
  const [value, setValue] = useState(saved ?? "");
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | undefined>();
  const [saving, setSaving] = useState(false);

  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const pilotId = value.trim();
    if (pilotId !== "" && !SIMBRIEF_PILOT_ID.test(pilotId)) {
      setMessage({ tone: "error", text: "A SimBrief pilot ID is a number, shown on your SimBrief account page." });
      return;
    }
    setSaving(true);
    const result = await authClient.updateUser({ simbriefPilotId: pilotId === "" ? null : pilotId });
    setSaving(false);
    if (result.error) {
      setMessage({ tone: "error", text: result.error.message ?? "Couldn't save the SimBrief pilot ID." });
      return;
    }
    setMessage({ tone: "info", text: pilotId === "" ? "SimBrief pilot ID removed." : "SimBrief pilot ID saved." });
    router.refresh();
  }

  return (
    <SettingsGroup title="SimBrief">
      <SettingsRow
        label="SimBrief Pilot ID"
        detail="In co-op, your co-pilot's flight plan uplink loads your latest SimBrief plan"
      >
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            void save(event);
          }}
        >
          <input
            aria-label="SimBrief pilot ID"
            inputMode="numeric"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setMessage(undefined);
            }}
            placeholder="123456"
            className="well h-10 w-32 rounded-xl px-3 text-[15px] text-paper tabular-nums outline outline-transparent transition-[outline-color] duration-200 placeholder:text-paper/30 focus:outline-paper/30"
          />
          <ActionButton type="submit" variant="ghost" size="sm" disabled={saving}>
            Save
          </ActionButton>
        </form>
      </SettingsRow>
      {message && (
        <div className="px-6 pb-4">
          <FormMessage tone={message.tone}>{message.text}</FormMessage>
        </div>
      )}
    </SettingsGroup>
  );
}
