"use client";

import { useEffect, useState } from "react";

// Counts up once every `ms` after mount. Starts at 0 on the server and the client, so
// anything derived from it hydrates cleanly and only starts moving afterwards.
export function useTick(ms: number): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setTick((value) => value + 1);
    }, ms);
    return () => {
      clearInterval(id);
    };
  }, [ms]);

  return tick;
}
