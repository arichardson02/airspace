import localFont from "next/font/local";

// Inter is the only brand face (Branding/BRAND.md). The shared design package holds the web
// files from Branding/fonts/Inter/web, so the site never fetches a font from Google.
export const inter = localFont({
  src: [
    { path: "../node_modules/@fs-career/ui/fonts/Inter-Regular.woff2", weight: "400" },
    { path: "../node_modules/@fs-career/ui/fonts/Inter-Medium.woff2", weight: "500" },
    { path: "../node_modules/@fs-career/ui/fonts/Inter-SemiBold.woff2", weight: "600" },
    { path: "../node_modules/@fs-career/ui/fonts/Inter-Bold.woff2", weight: "700" },
  ],
  variable: "--font-inter",
  display: "swap",
});
