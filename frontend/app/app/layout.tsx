import type { ReactElement, ReactNode } from "react";
import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import { AppShell } from "./shell";

// The signed-in app. proxy.ts turns away visitors with no session cookie; the layout checks the
// session for real, so every page under it has a user.
export default function AppLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <Suspense>
      <SignedInShell>{children}</SignedInShell>
    </Suspense>
  );
}

async function SignedInShell({ children }: { children: ReactNode }) {
  const user = await requireUser("/app");
  return <AppShell name={user.name}>{children}</AppShell>;
}
