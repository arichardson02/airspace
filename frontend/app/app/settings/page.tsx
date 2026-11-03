import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { requireUser } from "@/lib/session";
import { SettingsPage } from "./settings";

export const metadata: Metadata = { title: "Airspace · Settings" };

export default function Page(): ReactElement {
  return (
    <Suspense>
      <SignedInSettings />
    </Suspense>
  );
}

async function SignedInSettings() {
  const user = await requireUser("/app/settings");
  return <SettingsPage name={user.name} email={user.email} />;
}
