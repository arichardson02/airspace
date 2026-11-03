import type { ReactElement } from "react";
import type { Metadata } from "next";
import { EmptyPage } from "../empty-page";

export const metadata: Metadata = { title: "Airspace · Jobs" };

export default function JobsPage(): ReactElement {
  return (
    <EmptyPage
      title="Jobs"
      sub="Passenger and cargo jobs from the airport you are parked at."
      next="Jobs appear once the connector sees your aircraft on the ground."
    />
  );
}
