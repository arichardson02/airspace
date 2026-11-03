"use client";

import type { CSSProperties, ReactElement, ReactNode } from "react";

// The two approved framings. Each is a pixel-sized stage, tilted in CSS perspective and anchored to the card's
// right edge so the card crops it.
const poses = {
  tape: {
    stage: { width: 520, perspective: 800 },
    face: {
      right: -18,
      top: -90,
      width: 440,
      height: 400,
      transform: "rotateY(-24deg) rotateZ(7deg) rotateX(6deg)",
      transformOrigin: "80% 50%",
      // Fades in from the left so the tape has no panel behind it.
      WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 30%)",
      maskImage: "linear-gradient(to right, transparent 0%, black 30%)",
    },
  },
  deck: {
    stage: { width: 380, perspective: 900 },
    face: {
      right: 10,
      top: -30,
      width: 360,
      height: 360,
      transform: "rotateX(22deg) rotateY(-18deg) rotateZ(-3deg) scale(.82)",
      transformOrigin: "50% 40%",
    },
  },
} satisfies Record<string, { stage: CSSProperties; face: CSSProperties }>;

export type PitchedPose = keyof typeof poses;

/** Tilts an instrument into perspective at the right edge of a card. Give it as `art`. */
export function Pitched({ pose, children }: { pose: PitchedPose; children: ReactNode }): ReactElement {
  const { stage, face } = poses[pose];
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0" style={stage}>
      <div className="absolute" style={face}>
        {children}
      </div>
    </div>
  );
}
