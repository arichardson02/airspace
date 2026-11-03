"use client";

import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Briefcase, Globe, LayoutGrid, Settings, Star, Users } from "lucide-react";
import { Logo } from "@fs-career/ui/logo";
import {
  firstName,
  PageBar,
  Sidebar,
  SidebarAccount,
  SidebarItem,
  SidebarSection,
  type SidebarLink,
} from "@fs-career/ui/shell";

// The signed-in app's pages, grouped the way the sidebar shows them.
const appPages = [
  { group: "Fly", href: "/app", label: "Overview", icon: <LayoutGrid /> },
  { group: "Fly", href: "/app/jobs", label: "Jobs", icon: <Briefcase /> },
  { group: "Fly", href: "/app/map", label: "Live Map", icon: <Globe /> },
  { group: "Career", href: "/app/logbook", label: "Logbook", icon: <BookOpen /> },
  { group: "Career", href: "/app/rank", label: "Rank", icon: <Star /> },
  { group: "Club", href: "/app/coop", label: "Co-op", icon: <Users /> },
] as const;

// Settings opens from the gear beside the pilot's name, so it's kept out of the groups.
const settingsPage = { href: "/app/settings", label: "Settings", icon: <Settings /> };

const groups = [...new Set(appPages.map((page) => page.group))];

const RouterLink: SidebarLink = ({ href, className, children }) => (
  <Link href={href} className={className}>
    {children}
  </Link>
);

export function AppShell({ name, children }: { name: string; children: ReactNode }): ReactElement {
  const pathname = usePathname();
  const current = [...appPages, settingsPage].find((page) => page.href === pathname) ?? appPages[0];

  return (
    <div className="flex min-h-screen flex-1 bg-ink text-paper">
      <Sidebar
        brand={<Logo className="h-[18px]" />}
        account={
          <SidebarAccount
            name={firstName(name)}
            settingsHref={settingsPage.href}
            settingsActive={pathname === settingsPage.href}
            link={RouterLink}
          />
        }
      >
        {groups.map((group) => (
          <SidebarSection key={group} label={group}>
            {appPages
              .filter((page) => page.group === group)
              .map((page) => (
                <SidebarItem
                  key={page.href}
                  href={page.href}
                  label={page.label}
                  icon={page.icon}
                  active={page.href === pathname}
                  link={RouterLink}
                />
              ))}
          </SidebarSection>
        ))}
      </Sidebar>
      <div className="flex min-w-0 flex-1 flex-col">
        <PageBar icon={current.icon} title={current.label} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
