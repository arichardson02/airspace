"use client";

import type { ReactElement } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { ActionButton } from "@fs-career/ui/button";
import { AccountHeader, Page, SettingsGroup, SettingsRow } from "@fs-career/ui/shell";
import { authClient } from "@/lib/auth-client";

// Mirrors the connector's sign-in: it opens /device with its code and the pilot approves it.
const connectSteps = [
  { title: "Download the desktop app", body: "A small Windows app for Microsoft Flight Simulator 2020" },
  { title: "Start it with the sim open", body: "It finds the simulator by itself" },
  { title: "Approve its code", body: "It opens airspace.club/device once, then stays signed in" },
];

export function SettingsPage({ name, email }: { name: string; email: string }): ReactElement {
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

      <SettingsGroup title="Connect Your Sim">
        {connectSteps.map((step, index) => (
          <SettingsRow key={step.title} label={step.title} detail={step.body}>
            <span className="text-paper/35 tabular-nums">0{index + 1}</span>
          </SettingsRow>
        ))}
      </SettingsGroup>
    </Page>
  );
}
