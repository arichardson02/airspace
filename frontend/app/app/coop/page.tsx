import type { ReactElement } from "react";
import type { Metadata } from "next";
import { EmptyPage } from "../empty-page";

export const metadata: Metadata = { title: "Airspace · Co-op" };

export default function CoopPage(): ReactElement {
  return (
    <EmptyPage
      title="Co-op"
      sub="Share one cockpit with a friend. Whoever moves the controls flies."
      next="Join a group from the desktop app; it shows here while you fly."
    />
  );
}
