import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import { Dashboard } from "./dashboard";

export const metadata: Metadata = { title: "Dashboard · Airspace" };

export default function AppPage() {
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
