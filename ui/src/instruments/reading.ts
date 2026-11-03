import { useEffect, useRef } from "react";
import { useAnimationFrame, useMotionValue, type MotionValue } from "framer-motion";

interface Sample {
  at: number;
  value: number;
}

// How long the value keeps moving at the measured rate after the last reading, before it holds still.
const HOLD_S = 1.5;
// The rate is the slope across the readings of about this long, so one early or late reading barely moves it.
const WINDOW_S = 1.2;
// How quickly a difference from where the readings say it should be is eased out. Long enough that a reading's
// jitter in timing is spread over many frames instead of showing as a lurch.
const TAU_S = 0.5;
// A reading this far from where the value was heading is a jump (a new flight, a knob), not a trend: it eases there.
const JUMP = 500;

/**
 * A motion value that moves through a stream of readings like a gauge does. It measures how fast the reading is
 * changing and keeps moving at that rate between updates, easing out any error, so a climb fed ten times a second or
 * once a second scrolls at one even speed. A spring chasing each reading instead lurches forward and slows between
 * them. Under reduced motion it jumps to each reading.
 */
export function useReading(reading: number, still: boolean | null): MotionValue<number> {
  const value = useMotionValue(reading);
  // Recent readings and when they came, oldest first, and the rate across them in units a second.
  const trend = useRef<{ samples: Sample[]; rate: number }>({ samples: [], rate: 0 });

  useEffect(() => {
    const now = performance.now();
    const t = trend.current;
    const last = t.samples.at(-1);
    if (still === true) value.jump(reading);
    const heading = last ? last.value + t.rate * Math.min((now - last.at) / 1000, HOLD_S) : reading;
    // After a pause or a jump the trend starts over.
    if (!last || (now - last.at) / 1000 > HOLD_S || Math.abs(reading - heading) > JUMP) t.samples = [];
    t.samples.push({ at: now, value: reading });
    while (t.samples.length > 2 && (now - t.samples[0].at) / 1000 > WINDOW_S) t.samples.shift();
    const first = t.samples[0];
    t.rate = t.samples.length > 1 ? (reading - first.value) / ((now - first.at) / 1000) : 0;
  }, [reading, still, value]);

  // Framer passes the time since this loop began, not the page clock the readings were stamped with, so the frame
  // reads the page clock itself.
  useAnimationFrame((_, delta) => {
    if (still === true) return;
    const t = trend.current;
    const last = t.samples.at(-1);
    if (!last) return;
    const heading = last.value + t.rate * Math.min(Math.max(0, (performance.now() - last.at) / 1000), HOLD_S);
    const current = value.get();
    if (Math.abs(heading - current) < 0.001) return;
    value.set(current + (heading - current) * (1 - Math.exp(-delta / 1000 / TAU_S)));
  });

  return value;
}
