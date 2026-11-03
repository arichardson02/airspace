import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { Lab } from "./lab";

// The instrument lab: every instrument with knobs, to watch it animate. It never ships.
export default function LabPage(): ReactElement {
  if (process.env.NODE_ENV === "production") notFound();
  return <Lab />;
}
