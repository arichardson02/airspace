import type { ReactElement, ReactNode } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/session";
import { UserMenu } from "./user-menu";

// The signed-in app. proxy.ts turns away visitors with no session cookie; each page checks the
// session itself with requireUser().
export default function AppLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-ink text-paper">
      <header className="sticky top-0 z-50 border-b border-paper/8 bg-ink/85 backdrop-blur-xl">
        <nav aria-label="App" className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5">
          <Link href="/app" aria-label="Airspace dashboard" className="w-fit">
            <Logo inverted className="h-5" />
          </Link>
          <Suspense>
            <SignedInUser />
          </Suspense>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

async function SignedInUser() {
  const user = await getCurrentUser();
  return user && <UserMenu name={user.name} email={user.email} />;
}
