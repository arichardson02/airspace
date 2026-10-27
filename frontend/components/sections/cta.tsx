"use client";

import { motion, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/button";
import { ScrollGroup, Slide, Words, useScrollProgress } from "@/components/scroll-group";

// An attitude indicator's horizon and pitch ladder. It rolls level as the section scrolls
// in, the ladder extending from the centre, then keeps banking gently either way.
function Horizon() {
  const progress = useScrollProgress();
  const bank = useTransform(progress, [0, 1], [-10, 0]);
  const extend = useTransform(progress, [0.1, 0.9], [0, 1]);
  const opacity = useTransform(progress, [0, 0.6], [0, 1]);

  return (
    <motion.div aria-hidden style={{ rotate: bank, opacity }} className="pointer-events-none absolute inset-[-20%]">
      <motion.div
        animate={{ rotate: [-3, 3, -3] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0"
      >
        <motion.div style={{ scaleX: extend }} className="absolute inset-x-0 top-1/2 h-px bg-paper/40" />
        {[-3, -2, -1, 1, 2, 3].map((step) => (
          <motion.div
            key={step}
            style={{ top: `calc(50% + ${step * 9}vh)`, width: `${(4 - Math.abs(step)) * 6}vw`, scaleX: extend }}
            className="absolute left-1/2 h-px -translate-x-1/2 bg-paper/25"
          />
        ))}
      </motion.div>
    </motion.div>
  );
}

export function Cta() {
  return (
    <section id="download" aria-labelledby="download-title" className="overflow-hidden bg-ink text-paper">
      {/* The group needs a box of its own to measure, so it is the section's whole inside. */}
      <ScrollGroup className="relative flex min-h-screen items-center" from="start 90%" to="start 10%">
        <Horizon />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_45%_at_50%_50%,rgba(11,13,16,0.95),rgba(11,13,16,0.4)_70%,transparent)]" />

        <div className="relative mx-auto flex w-full max-w-7xl flex-col items-center px-5 py-24 text-center">
          <h2 id="download-title" className="display text-5xl sm:text-7xl md:text-8xl">
            <Words text="Start Flying" range={[0.2, 0.75]} className="justify-center" />
          </h2>
          <Slide from="bottom" range={[0.5, 0.9]}>
            <p className="mt-6 max-w-sm text-lg text-paper/60 sm:text-xl">Free while Airspace is in early access.</p>
          </Slide>
          <Slide from="bottom" range={[0.6, 1]}>
            <Button href="/signup" variant="paper" className="mt-10">
              Get Started
              <ArrowRight className="size-4" />
            </Button>
          </Slide>
        </div>
      </ScrollGroup>
    </section>
  );
}
