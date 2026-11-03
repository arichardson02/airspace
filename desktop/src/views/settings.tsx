import type { ReactElement } from "react";
import { LogOut } from "lucide-react";
import type { Pilot, UpdateStatus } from "@fs-career/contracts";
import { ActionButton } from "@fs-career/ui/button";
import { AccountHeader, Page, SettingsGroup, SettingsRow } from "@fs-career/ui/shell";
import { send } from "../lib/connector";

export function Settings({
  pilot,
  version,
  update,
}: {
  pilot: Pilot;
  version: string;
  update: UpdateStatus;
}): ReactElement {
  return (
    <Page title="Settings" className="max-w-3xl">
      <AccountHeader
        name={pilot.name}
        email={pilot.email}
        action={
          <ActionButton
            variant="ghost"
            size="sm"
            onClick={() => {
              send({ type: "sign-out" });
            }}
          >
            <LogOut className="size-4" />
            Sign Out
          </ActionButton>
        }
      />
      <p className="mt-3 px-1 text-[13px] text-muted">Signing out leaves any co-op group and forgets this computer.</p>

      <SettingsGroup title="About">
        <SettingsRow label="Version">
          <span className="tabular-nums">{version}</span>
        </SettingsRow>
        <UpdateRow update={update} />
        <SettingsRow label="Simulator">Microsoft Flight Simulator 2020</SettingsRow>
        <SettingsRow label="System">Windows 10 and 11</SettingsRow>
      </SettingsGroup>
    </Page>
  );
}

// Nothing shows while the app is up to date; a new release appears here as it downloads, then waits for a restart.
function UpdateRow({ update }: { update: UpdateStatus }): ReactElement | null {
  if (update.state === "downloading") {
    return (
      <SettingsRow label="Downloading Update" detail={`Version ${update.version}`}>
        <span className="tabular-nums">{update.percent}%</span>
      </SettingsRow>
    );
  }
  if (update.state === "installing") {
    return <SettingsRow label="Installing Update" detail={`Airspace restarts on version ${update.version}`} />;
  }
  if (update.state === "ready") {
    return (
      <SettingsRow label="Update Ready" detail={`Version ${update.version} installs when you close Airspace`}>
        <ActionButton
          variant="ghost"
          size="sm"
          onClick={() => {
            send({ type: "restart-to-update" });
          }}
        >
          Restart
        </ActionButton>
      </SettingsRow>
    );
  }
  return null;
}
