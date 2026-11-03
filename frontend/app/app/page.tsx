import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { requireUser } from "@/lib/session";
import { Dashboard } from "./dashboard";

export const metadata: Metadata = { title: "Dashboard · Airspace" };

export default function AppPage(): ReactElement {
  return (
    <Suspense>
      <SignedInDashboard />
    </Suspense>
  );
}

async function SignedInDashboard() {
  const user = await requireUser("/app");
  return <Dashboard name={user.name} />;
}
