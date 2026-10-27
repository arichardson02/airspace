import { Footer } from "@/components/footer";
import { Intro } from "@/components/intro";
import { Navbar } from "@/components/navbar";
import { Careers } from "@/components/sections/careers";
import { Community } from "@/components/sections/community";
import { Cta } from "@/components/sections/cta";
import { Features } from "@/components/sections/features";
import { Hero } from "@/components/sections/hero";

export default function Home() {
  return (
    <>
      <Intro />
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Features />
        <Careers />
        <Community />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
