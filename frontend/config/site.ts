// Everything the marketing page says. Copy lives here so the sections stay layout only.
export const siteConfig = {
  name: "Airspace",
  url: "https://airspace.club",
  title: "Airspace",
  description:
    "Jobs in any aircraft, a logbook that fills itself, and a club to share it with - all for Microsoft Flight Simulator.",
  discord: "https://discord.gg/airspace",
};

export type Theme = "ink" | "paper";

// The page's sections in order. The navbar tracks which one is on screen and takes its
// theme, so the bar always matches the background under it.
export const sections: { id: string; label: string; theme: Theme }[] = [
  { id: "home", label: "Home", theme: "ink" },
  { id: "features", label: "Features", theme: "paper" },
  { id: "tour", label: "Tour", theme: "ink" },
  { id: "community", label: "Community", theme: "paper" },
  { id: "download", label: "Download", theme: "ink" },
];
