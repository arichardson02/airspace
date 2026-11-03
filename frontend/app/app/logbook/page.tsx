import type { ReactElement } from "react";
import type { Metadata } from "next";
import { EmptyPage } from "../empty-page";

export const metadata: Metadata = { title: "Airspace · Logbook" };

export default function LogbookPage(): ReactElement {
  return (
    <EmptyPage
      title="Logbook"
      sub="Every flight with its route, time and landing. You never type a line."
      next="Your first flight with the connector running goes here."
    />
  );
}
