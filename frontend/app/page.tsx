import type { ReactElement } from "react";
import { Footer } from "@/components/footer";
import { Intro } from "@fs-career/ui/intro";
import { Navbar } from "@/components/navbar";
import { Seam } from "@/components/seam";
import { Community } from "@/components/sections/community";
import { Cta } from "@/components/sections/cta";
import { Features } from "@/components/sections/features";
import { Hero } from "@/components/sections/hero";
import { Tour } from "@/components/sections/tour";

export default function Home(): ReactElement {
  return (
    <>
      <Intro />
      <Navbar />
      <main className="flex-1">
        {/* Sections alternate between the two tones, and each change of tone is drawn as a pattern. */}
        <Hero />
        <Seam from="ink" to="ink-2" pattern="halftone" />
        <Features />
        <Seam from="ink-2" to="ink" pattern="lines" />
        <Tour />
        <Seam from="ink" to="ink-2" pattern="halftone" />
        <Community />
        <Seam from="ink-2" to="ink" pattern="lines" />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
