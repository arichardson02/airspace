import type { MotionProps } from "framer-motion";

// The Airspace motion: things rise into place with a long quint ease.
export const ease = [0.22, 1, 0.36, 1] as const;

// Props for React's <ViewTransition>. A screen swapped inside a transition (startTransition, or a Next.js navigation)
// fades out and its replacement rises in; `default: "none"` keeps every other update still. The classes are styled in
// theme.css.
export const screenTransition = { enter: "screen-enter", exit: "screen-exit", default: "none" } as const;

// The logo is one element wherever it shows: moving between screens it glides from one place and size to the other.
export const logoTransition = { name: "airspace-logo", share: "logo-morph", default: "none" } as const;

export const rise = (delay = 0): Required<Pick<MotionProps, "initial" | "animate" | "transition">> => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, ease, delay },
});
