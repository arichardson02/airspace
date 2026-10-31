import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import { DeviceApproval } from "./device-approval";

export const metadata: Metadata = { title: "Connect Connector · Airspace" };

// The connector opens this page with ?user_code= to sign itself in to the pilot's account.
export default function DevicePage({ searchParams }: PageProps<"/device">) {
  return (
    <Suspense>
      <DeviceGate searchParams={searchParams} />
    </Suspense>
  );
}

async function DeviceGate({ searchParams }: Pick<PageProps<"/device">, "searchParams">) {
  const { user_code } = await searchParams;
  const code = typeof user_code === "string" ? user_code : "";
  const user = await requireUser(code ? `/device?user_code=${encodeURIComponent(code)}` : "/device");

  return <DeviceApproval email={user.email} initialCode={code} />;
}
