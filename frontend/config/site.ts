// Everything the marketing page says. Copy lives here so the sections stay layout only.
export const siteConfig = {
  name: "Airspace",
  url: "https://airspace.club",
  title: "Airspace",
  description: "Jobs, a logbook and a club for Microsoft Flight Simulator.",
  discord: "https://discord.gg/airspace",
  // The desktop installer from the latest release (.github/workflows/desktop-release.yml); /download redirects here.
  desktopDownload: "https://github.com/arichardson02/airspace/releases/latest/download/Airspace-Setup.exe",
};

// The page's sections in order. The navbar highlights the one showing the most.
export const sections: { id: string; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "features", label: "Features" },
  { id: "tour", label: "Tour" },
  { id: "community", label: "Community" },
  { id: "download", label: "Download" },
];
