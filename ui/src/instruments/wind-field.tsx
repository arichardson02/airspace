"use client";

import { useEffect, useRef, type ReactElement } from "react";
import { useReducedMotion } from "framer-motion";
import { clamp, seeded, useShown } from "./svg";

// The field is a square as wide as the card's diagonal, so turning it never shows an empty corner. About a third
// of it is on the card.
const COUNT = 300;
// Particles fade in over the first part of their path and out over the last.
const FADE = 0.16;
// Alpha is drawn in a few steps so a frame is a handful of strokes, not one per particle.
const LEVELS = 6;
// How quickly the field turns to a new direction and settles to a new speed, per second.
const TURN = 3;
const SETTLE = 2;
// The fraction of the card on the left, under the text, that the field fades out over.
const MASK = "linear-gradient(to right, transparent 32%, black 72%)";

const travel = (kt: number) => 10 + kt * 5;
const streak = (kt: number) => 5 + kt * 1.3;
// The short way round from `from` to `to`, in degrees.
const turnBy = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180;
// Streaks are drawn blowing along +x. The wind blows towards from + 180, and on screen bearing b points along
// (sin b, -cos b), which is +x turned by b - 90, so from + 90.
const heading = (from: number) => ((from + 90) * Math.PI) / 180;

interface Particle {
  /** 0..1 along the flow, from the field's upwind edge to its downwind one. */
  t: number;
  /** 0..1 across the flow. */
  s: number;
  /** 0..1, how bright it is at full life. */
  strength: number;
  /** Its own speed, so the field doesn't move in lockstep. */
  pace: number;
}

// Streaks flowing the way the wind blows, on one canvas. Each particle is born on the upwind edge, fades in, crosses
// the field and fades out before the downwind edge, then is born again upwind. Particles live in the wind's own
// frame and the whole field is turned by one canvas rotation about the card's centre, so a new direction turns it
// rigidly the short way round. `direction` is where the wind comes from, in degrees.
export function WindField({ direction, speed }: { direction: number; speed: number }): ReactElement {
  const ref = useRef<HTMLCanvasElement>(null);
  const shown = useShown(ref);
  const still = useReducedMotion();
  const target = useRef({ direction, speed });
  const state = useRef({ direction, speed });
  const particles = useRef<Particle[]>([]);
  const box = useRef({ width: 0, height: 0, ratio: 1 });
  const draw = useRef<() => void>(() => undefined);

  useEffect(() => {
    target.current = { direction, speed };
    if (still === true) {
      state.current = { direction, speed };
      draw.current();
    }
  }, [direction, speed, still]);

  // The particles and the drawing are set up once; the loop below only advances and redraws them.
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;
    const next = seeded(11);
    particles.current = Array.from({ length: COUNT }, () => ({
      t: next(),
      s: next(),
      strength: 0.25 + next() * 0.75,
      pace: 0.7 + next() * 0.6,
    }));
    const colour = getComputedStyle(canvas).color;

    const size = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      box.current = { width, height, ratio };
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.strokeStyle = colour;
      context.lineCap = "round";
      context.lineWidth = 1.4;
      draw.current();
    };

    draw.current = () => {
      const { width, height, ratio } = box.current;
      const half = Math.hypot(width, height) / 2;
      const length = streak(state.current.speed);
      const paths = Array.from({ length: LEVELS }, () => new Path2D());
      for (const { t, s, strength } of particles.current) {
        const life = Math.min(t / FADE, (1 - t) / FADE, 1);
        const level = Math.round(clamp(life * strength) * (LEVELS - 1));
        if (level === 0) continue;
        const u = (t * 2 - 1) * half;
        const w = (s * 2 - 1) * half;
        paths[level].moveTo(u - length, w);
        paths[level].lineTo(u, w);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.translate(width / 2, height / 2);
      context.rotate(heading(state.current.direction));
      paths.forEach((path, level) => {
        context.globalAlpha = (level / (LEVELS - 1)) * 0.75;
        context.stroke(path);
      });
    };

    const observer = new ResizeObserver(size);
    observer.observe(canvas);
    size();
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (still === true || !shown) return undefined;
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      const current = state.current;
      const goal = target.current;
      current.direction += turnBy(current.direction, goal.direction) * (1 - Math.exp(-dt * TURN));
      current.speed += (goal.speed - current.speed) * (1 - Math.exp(-dt * SETTLE));
      const { width, height } = box.current;
      const step = (travel(current.speed) * dt) / Math.max(1, Math.hypot(width, height));
      for (const particle of particles.current) {
        particle.t += step * particle.pace;
        if (particle.t >= 1) {
          particle.t -= 1;
          particle.s = Math.random();
        }
      }
      draw.current();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [still, shown]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none size-full text-paper"
      style={{ maskImage: MASK, WebkitMaskImage: MASK }}
    />
  );
}
