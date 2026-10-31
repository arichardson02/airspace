import type { ReactNode } from "react";
import Link from "next/link";
import { FlightMap } from "@/components/flight-map";
import { Logo } from "@/components/logo";

// Sign-in pages sit on the hero's ink and route map, so they read as the same place.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-ink text-paper">
      <div aria-hidden className="absolute inset-0 opacity-60">
        <FlightMap className="h-full w-full text-paper" />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_60%_at_50%_50%,rgba(11,13,16,0.95),rgba(11,13,16,0.6)_65%,rgba(11,13,16,0.25))]" />

      <header className="relative mx-auto flex h-14 w-full max-w-7xl items-center px-5">
        <Link href="/" aria-label="Airspace home" className="w-fit">
          <Logo inverted className="h-5" />
        </Link>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-5 pt-6 pb-20">{children}</main>
    </div>
  );
}
