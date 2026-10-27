// Everything the marketing page says. Copy lives here so the sections stay layout only.
export const siteConfig = {
  name: "Airspace",
  url: "https://airspace.club",
  title: "Airspace",
  description:
    "Airspace is a career app for Microsoft Flight Simulator. Take jobs, rank up, and fly with other pilots. Every flight is logged automatically.",
  discord: "https://discord.gg/airspace",
};

export type Theme = "ink" | "paper";

// The page's sections in order. The navbar tracks which one is on screen and takes its
// theme, so the bar always matches the background under it.
export const sections: { id: string; label: string; theme: Theme }[] = [
  { id: "home", label: "Home", theme: "ink" },
  { id: "features", label: "Features", theme: "paper" },
  { id: "careers", label: "Careers", theme: "ink" },
  { id: "community", label: "Community", theme: "paper" },
  { id: "download", label: "Download", theme: "ink" },
];
