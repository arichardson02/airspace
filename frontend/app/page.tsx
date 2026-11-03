import type { ReactElement } from "react";
import { Footer } from "@/components/footer";
import { Intro } from "@/components/intro";
import { Navbar } from "@/components/navbar";
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
        <Hero />
        <Features />
        <Tour />
        <Community />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
