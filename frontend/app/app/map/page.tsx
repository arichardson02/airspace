import type { ReactElement } from "react";
import type { Metadata } from "next";
import { LiveMap } from "./live-map";

export const metadata: Metadata = { title: "Airspace · Live Map" };

export default function LiveMapPage(): ReactElement {
  return <LiveMap />;
}
