"use client";

import { useState, type ReactElement } from "react";
import { motion } from "framer-motion";
import { AppWindow } from "@/components/app-window";
import { RollStack } from "@/components/roll-stack";
import { SCENE_MS, steps } from "@/components/scenes";
import { ScrollGroup, Slide, Words } from "@/components/scroll-group";
import { useTick } from "@/lib/use-tick";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

// The steps on the left advance by themselves, with a thin timer under the open one. On
// the right is a browser window showing the app: its address changes with the step and
// the page inside rolls to that step's scene. Clicking a step jumps to it and stops the
// timer. The whole thing builds with the scroll: heading, then each step, then the window.
export function Tour(): ReactElement {
  const tick = useTick(SCENE_MS);
  const [picked, setPicked] = useState<number | null>(null);
  const current = picked ?? tick % steps.length;

  return (
    <section id="tour" aria-labelledby="tour-title" className="flex min-h-screen items-center bg-ink text-paper">
      <ScrollGroup className="mx-auto w-full max-w-7xl px-5 py-24 sm:py-32" to="start 30%">
        <h2 id="tour-title" className="display text-4xl sm:text-5xl md:text-6xl">
          <Words text="Tour" range={[0, 0.4]} />
        </h2>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
          <ol className="flex flex-col">
            {steps.map((step, index) => {
              const on = index === current;
              return (
                <Slide key={step.title} from="left" range={[0.15 + index * 0.08, 0.55 + index * 0.08]}>
                  <li className="border-t border-paper/10 last:border-b">
                    <button
                      type="button"
                      onClick={() => {
                        setPicked(index);
                      }}
                      className="relative block w-full py-5 text-left"
                    >
                      <div className="flex items-baseline gap-5">
                        <span
                          className={cn(
                            "text-sm font-semibold tabular-nums transition-colors",
                            on ? "text-paper" : "text-paper/35",
                          )}
                        >
                          0{index + 1}
                        </span>
                        <h3
                          className={cn(
                            "display text-2xl transition-colors sm:text-3xl",
                            on ? "text-paper" : "text-paper/45",
                          )}
                        >
                          {step.title}
                        </h3>
                      </div>
                      <motion.div
                        animate={{ height: on ? "auto" : 0, opacity: on ? 1 : 0 }}
                        transition={{ duration: 0.45, ease }}
                        className="overflow-hidden pl-[2.4rem]"
                      >
                        <p className="max-w-md pt-2 text-[15px] leading-relaxed text-paper/55">{step.body}</p>
                      </motion.div>
                      {on && picked === null && (
                        <motion.span
                          key={tick}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ duration: SCENE_MS / 1000, ease: "linear" }}
                          className="absolute inset-x-0 -bottom-px h-px origin-left bg-paper"
                        />
                      )}
                    </button>
                  </li>
                </Slide>
              );
            })}
          </ol>

          <Slide from="right" range={[0.3, 0.9]}>
            <AppWindow url={steps[current].url}>
              <RollStack
                axis="y"
                current={current}
                slideClassName="min-h-[460px] p-6 sm:p-8"
                items={steps.map((step, index) => ({
                  id: step.title,
                  // Remounting on activation restarts the scene from its first phase.
                  content: <step.Scene key={String(index === current)} active={index === current} />,
                }))}
              />
            </AppWindow>
          </Slide>
        </div>
      </ScrollGroup>
    </section>
  );
}
