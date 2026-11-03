import type { ReactElement } from "react";
import { LogOut } from "lucide-react";
import type { Pilot } from "@fs-career/contracts";
import { ActionButton } from "@fs-career/ui/button";
import { AccountHeader, Page, SettingsGroup, SettingsRow } from "@fs-career/ui/shell";
import { send } from "../lib/connector";

export function Settings({ pilot, version }: { pilot: Pilot; version: string }): ReactElement {
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
        <SettingsRow label="Simulator">Microsoft Flight Simulator 2020</SettingsRow>
        <SettingsRow label="System">Windows 10 and 11</SettingsRow>
      </SettingsGroup>
    </Page>
  );
}
