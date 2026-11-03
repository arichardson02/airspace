import type { ReactElement } from "react";

const PAPER = "246 247 249";

// A soft light falling in from the top-right corner, with a faint diagonal band across the card. Two CSS gradients,
// no texture, so it never bands into dots and costs nothing to draw.
const light = [
  `radial-gradient(120% 140% at 105% -20%, rgb(${PAPER} / 0.1) 0%, rgb(${PAPER} / 0.04) 35%, rgb(${PAPER} / 0) 65%)`,
  `linear-gradient(115deg, rgb(${PAPER} / 0) 45%, rgb(${PAPER} / 0.035) 62%, rgb(${PAPER} / 0) 78%)`,
].join(", ");

/** A smooth diagonal corner light for a card's background. */
export function Beam(): ReactElement {
  return <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: light }} />;
}
