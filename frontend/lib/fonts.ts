import localFont from "next/font/local";

// Inter is the only brand face (Branding/BRAND.md). app/fonts holds the web files from
// Branding/fonts/Inter/web, so the site never fetches a font from Google.
export const inter = localFont({
  src: [
    { path: "../app/fonts/Inter-Regular.woff2", weight: "400" },
    { path: "../app/fonts/Inter-Medium.woff2", weight: "500" },
    { path: "../app/fonts/Inter-SemiBold.woff2", weight: "600" },
    { path: "../app/fonts/Inter-Bold.woff2", weight: "700" },
  ],
  variable: "--font-inter",
  display: "swap",
});
