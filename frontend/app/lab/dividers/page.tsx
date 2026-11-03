import type { ReactElement } from "react";
import { notFound } from "next/navigation";
import { Dividers } from "./dividers";

// Section divider concepts, each between two tone-stepped sections. It never ships.
export default function DividersPage(): ReactElement {
  if (process.env.NODE_ENV === "production") notFound();
  return <Dividers />;
}
