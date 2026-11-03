import type { Metadata } from "next";
import { Suspense, type ReactElement } from "react";
import { requireUser } from "@/lib/session";
import { DeviceApproval } from "./device-approval";

export const metadata: Metadata = { title: "Connect Connector · Airspace" };

// The connector opens this page with ?user_code= to sign itself in to the pilot's account.
export default function DevicePage({ searchParams }: PageProps<"/device">): ReactElement {
  return (
    <Suspense>
      <DeviceGate searchParams={searchParams} />
    </Suspense>
  );
}

async function DeviceGate({ searchParams }: Pick<PageProps<"/device">, "searchParams">) {
  const { user_code } = await searchParams;
  // Next gives a repeated parameter as an array; only a single code is one the connector sent.
  const code = Array.isArray(user_code) ? "" : (user_code ?? "");
  const user = await requireUser(code === "" ? "/device" : `/device?user_code=${encodeURIComponent(code)}`);

  return <DeviceApproval email={user.email} initialCode={code} />;
}
