import type { ReactElement } from "react";
import type { Metadata } from "next";
import { EmptyPage } from "../empty-page";

export const metadata: Metadata = { title: "Airspace · Rank" };

export default function RankPage(): ReactElement {
  return (
    <EmptyPage
      title="Rank"
      sub="XP from every job moves you up the ranks."
      next="Complete a job to earn your first XP."
    />
  );
}
