"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/button";
import { FlightMap } from "@/components/flight-map";
import { INTRO_SECONDS } from "@/components/intro";
import { siteConfig } from "@/config/site";

const ease = [0.22, 1, 0.36, 1] as const;
const words = "Wherever You're Parked, There's a Job.".split(" ");

export function Hero() {
  // Everything waits for the intro curtain, unless there is no intro.
  const start = useReducedMotion() ? 0 : INTRO_SECONDS - 0.4;

  const rise = (delay: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, ease, delay: start + delay },
  });

  return (
    <section
      id="home"
      aria-labelledby="hero-title"
      className="relative flex min-h-screen items-center overflow-hidden bg-ink text-paper"
    >
      <motion.div
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2, ease, delay: start }}
        className="absolute inset-0"
      >
        <FlightMap className="h-full w-full text-paper" />
      </motion.div>
      {/* Darkens the middle for the headline and fades the map into the next section. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_50%,rgba(11,13,16,0.92),rgba(11,13,16,0.55)_60%,rgba(11,13,16,0.15))]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ink" />

      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-5 pt-14 text-center">
        <h1
          id="hero-title"
          className="display flex max-w-5xl flex-wrap justify-center gap-x-[0.22em] text-5xl leading-[1.02] sm:text-6xl md:text-7xl lg:text-[5.5rem]"
        >
          {words.map((word, index) => (
            <motion.span
              key={index}
              className="inline-block"
              initial={{ opacity: 0, y: "0.35em", filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.8, ease, delay: start + 0.1 + index * 0.06 }}
            >
              {word}
            </motion.span>
          ))}
        </h1>

        <motion.p {...rise(0.7)} className="mt-7 max-w-xl text-lg leading-relaxed text-paper/65 sm:text-xl">
          {siteConfig.description}
        </motion.p>

        <motion.div {...rise(0.85)} className="mt-10">
          <Button href="/signup" variant="paper">
            Get Started
            <ArrowRight className="size-4" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
