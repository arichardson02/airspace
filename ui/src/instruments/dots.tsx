import type { ReactElement } from "react";
import { round } from "./svg";

/** One dot of the dot-matrix look. Colour comes from `currentColor`, so it inherits paper. */
export function dot(x: number, y: number, r: number, opacity = 1): ReactElement {
  return (
    <circle
      key={`${round(x)},${round(y)}`}
      cx={round(x)}
      cy={round(y)}
      r={r}
      fill="currentColor"
      fillOpacity={opacity}
    />
  );
}
