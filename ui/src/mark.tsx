import type { ReactElement, SVGProps } from "react";

// The A mark from Branding/logo/mark.svg as inline SVG, for places that animate it or
// colour it with currentColor.
export const markPath =
  "M40.61221,10.72832c2.77899,-6.31728 9.09302,-10.72832 16.43729,-10.72832c7.34427,0 13.6583,4.41103 16.43729,10.72832l27.53161,59.04173l-34.99454,-15.36113v-26.20379c0,-4.9564 -4.01796,-8.97436 -8.97436,-8.97436c-4.9564,0 -8.97436,4.01796 -8.97436,8.97436v26.20379l-34.99454,15.36113zM110.06956,89.1803l4.02945,8.64119c-2.04295,1.37562 -4.50357,2.17851 -7.15171,2.17851h-27.84351l-13.07993,-8.17324v-21.98066zM34.99522,100h-27.84351c-2.64814,0 -5.10876,-0.80288 -7.15171,-2.17851l4.02945,-8.64119l44.04569,-19.3342v21.98066z";

export const markViewBox = "0 0 114.1 100";

export function Mark(props: SVGProps<SVGSVGElement>): ReactElement {
  return (
    <svg viewBox={markViewBox} aria-hidden {...props}>
      <path d={markPath} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
