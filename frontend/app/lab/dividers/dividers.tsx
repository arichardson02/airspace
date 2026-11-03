"use client";

import type { ReactElement, ReactNode } from "react";
import { useCanvas } from "@/components/use-canvas";
import { halftone as sharedHalftone, lines as sharedLines, smooth } from "@/components/seam-patterns";

// Two section tones: the page's ink and one step lighter. Every concept carries the page from one to the other, shown
// with a bit of real section content on either side so it can be judged in use.
const INK = "#0b0d10";
const STEP = "#181b21";
const PAPER = "246 247 249";
const STEP_RGB = [24, 27, 33] as const;

const keyframes = `
@keyframes dv-ping { from { r: 40; opacity: .5 } to { r: 900; opacity: 0 } }
@keyframes dv-drift { from { transform: translateX(0) } to { transform: translateX(-80px) } }
`;

// A canvas the width of the page, drawn once per size.
function Canvas({
  height,
  draw,
}: {
  height: number;
  draw: (c: CanvasRenderingContext2D, w: number, h: number) => void;
}): ReactElement {
  const ref = useCanvas(height, draw);
  return <canvas ref={ref} className="block w-full" style={{ height }} />;
}

// The pattern's slate on ink, as the Band draws it.
const onInk =
  (pattern: (c: CanvasRenderingContext2D, w: number, h: number) => void) =>
  (c: CanvasRenderingContext2D, w: number, h: number): void => {
    c.fillStyle = INK;
    c.fillRect(0, 0, w, h);
    c.fillStyle = STEP;
    pattern(c, w, h);
  };

// Halftone: slate dots on ink that grow until they merge into the slate section.
const halftone = onInk(sharedHalftone);

// Ordered dither: a 4×4 Bayer matrix of square pixels, the way old screens faded between two tones.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function dither(c: CanvasRenderingContext2D, w: number, h: number) {
  const cell = 5;
  c.fillStyle = INK;
  c.fillRect(0, 0, w, h);
  c.fillStyle = STEP;
  for (let j = 0; j * cell < h; j++) {
    const t = (j * cell) / h;
    for (let i = 0; i * cell < w; i++) {
      if (BAYER[(j % 4) * 4 + (i % 4)] / 16 < t) c.fillRect(i * cell, j * cell, cell, cell);
    }
  }
}

// Line density: slate lines that thicken down the band until they close into the slate section.
const lines = onInk(sharedLines);

// Topography: contour lines of a smooth made-up terrain, anti-aliased by the field's own slope, fading in at the top
// and out at the bottom, over ink turning into slate.
function topo(c: CanvasRenderingContext2D, w: number, h: number) {
  const dpr = window.devicePixelRatio || 1;
  const W = Math.round(w * dpr);
  const H = Math.round(h * dpr);
  const img = c.createImageData(W, H);
  const field = (x: number, y: number) =>
    Math.sin(x * 0.0042 + Math.cos(y * 0.006) * 1.6) * 1.1 +
    Math.cos(y * 0.0075 - x * 0.0021) * 0.9 +
    Math.exp(-((x - w * 0.68) ** 2 + (y - h * 0.55) ** 2) / 26000) * 2.4 +
    Math.exp(-((x - w * 0.2) ** 2 + (y - h * 0.35) ** 2) / 40000) * 1.8;
  const LEVELS = 7;
  for (let py = 0; py < H; py++) {
    const y = py / dpr;
    const t = y / h;
    const base = [0, 1, 2].map((k) => [11, 13, 16][k] + (STEP_RGB[k] - [11, 13, 16][k]) * smooth(t));
    const fade = Math.sin(Math.PI * t) ** 0.8;
    for (let px = 0; px < W; px++) {
      const x = px / dpr;
      const v = field(x, y) * LEVELS;
      const dx = (field(x + 0.5, y) - field(x - 0.5, y)) * LEVELS;
      const dy = (field(x, y + 0.5) - field(x, y - 0.5)) * LEVELS;
      const slope = Math.hypot(dx, dy) * dpr + 1e-4;
      const d = Math.abs(v - Math.round(v)) / slope;
      const major = Math.round(v) % 5 === 0;
      const a = Math.max(0, 1 - d / (major ? 0.9 : 0.6)) * (major ? 0.26 : 0.11) * fade;
      const i = (py * W + px) * 4;
      img.data[i] = base[0] + (246 - base[0]) * a;
      img.data[i + 1] = base[1] + (247 - base[1]) * a;
      img.data[i + 2] = base[2] + (249 - base[2]) * a;
      img.data[i + 3] = 255;
    }
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.putImageData(img, 0, 0);
}

function Content({ title, cards }: { title: string; cards?: boolean }) {
  return (
    <div className="relative mx-auto max-w-6xl px-10 py-14">
      <h3 className="display text-4xl">{title}</h3>
      {cards === true && (
        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="surface h-32 rounded-[18px]" />
          <div className="surface h-32 rounded-[18px]" />
        </div>
      )}
    </div>
  );
}

// Vercel- and Linear-style structure: rails down the content edges, a rule between sections and a cross where they
// meet. Plain sections alternate with dotted ones.
function Rails() {
  const cross = (side: "left" | "right") => (
    <span
      className="absolute top-0 z-10 size-[13px] -translate-y-1/2"
      style={{ [side]: "calc(50% - 36rem)", transform: `translate(${side === "left" ? "-50%" : "50%"}, -50%)` }}
    >
      <span
        className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2"
        style={{ background: `rgb(${PAPER} / .55)` }}
      />
      <span
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2"
        style={{ background: `rgb(${PAPER} / .55)` }}
      />
    </span>
  );
  const rails = (
    <div
      className="pointer-events-none absolute inset-y-0 left-1/2 w-[72rem] -translate-x-1/2 border-x"
      style={{ borderColor: `rgb(${PAPER} / .08)` }}
    />
  );
  return (
    <div>
      <div className="relative" style={{ background: INK }}>
        {rails}
        <Content title="What You Get" cards />
      </div>
      <div className="relative" style={{ borderTop: `1px solid rgb(${PAPER} / .1)` }}>
        {cross("left")}
        {cross("right")}
        <div
          className="relative"
          style={{
            backgroundColor: STEP,
            backgroundImage: `radial-gradient(rgb(${PAPER} / .09) 1px, transparent 1.2px)`,
            backgroundSize: "24px 24px",
            backgroundPosition: "center top",
          }}
        >
          {rails}
          <Content title="Tour" />
        </div>
      </div>
    </div>
  );
}

// The next section is the planet: its limb rises out of the ink with the atmosphere's light along it and a faint
// graticule inside, the same globe the live map is drawn on.
function Limb() {
  const R = 9000;
  return (
    <div style={{ background: INK }}>
      <Content title="Your Club" cards />
      <svg viewBox="0 0 1440 220" preserveAspectRatio="xMidYMax slice" className="block h-[220px] w-full">
        <defs>
          <radialGradient id="dv-atmo" cx="720" cy={220 + R - 60} r={R + 90} gradientUnits="userSpaceOnUse">
            <stop offset={(R - 10) / (R + 90)} stopColor={`rgb(${PAPER})`} stopOpacity={0.12} />
            <stop offset={1} stopColor={`rgb(${PAPER})`} stopOpacity={0} />
          </radialGradient>
          <clipPath id="dv-planet">
            <circle cx={720} cy={220 + R - 60} r={R} />
          </clipPath>
        </defs>
        <circle cx={720} cy={220 + R - 60} r={R + 90} fill="url(#dv-atmo)" />
        <circle cx={720} cy={220 + R - 60} r={R} fill={STEP} />
        <g clipPath="url(#dv-planet)" stroke={`rgb(${PAPER} / .07)`} fill="none">
          {Array.from({ length: 13 }, (_, i) => (
            <ellipse key={i} cx={720} cy={220 + R - 60} rx={(Math.abs(i - 6) / 6) * R} ry={R} />
          ))}
          {[60, 130, 210].map((dy) => (
            <ellipse key={dy} cx={720} cy={220 + R - 60} rx={R - dy * 0.4} ry={R - dy} />
          ))}
        </g>
        <circle cx={720} cy={220 + R - 60} r={R} fill="none" stroke={`rgb(${PAPER} / .35)`} strokeWidth={1} />
      </svg>
      <div style={{ background: STEP }}>
        <Content title="Start Flying" />
      </div>
    </div>
  );
}

// A perspective apron grid: the next section begins at a horizon and its floor runs toward you, fading as it comes.
function Floor() {
  const H = 240;
  const vx = 720;
  return (
    <div style={{ background: INK }}>
      <Content title="Tour" cards />
      <div className="relative" style={{ background: STEP }}>
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, rgb(${PAPER} / .4), transparent)` }}
        />
        <div
          className="absolute inset-x-0 top-0 h-24"
          style={{ background: `radial-gradient(50% 100% at 50% 0%, rgb(${PAPER} / .08), transparent)` }}
        />
        <svg
          viewBox={`0 0 1440 ${H}`}
          preserveAspectRatio="xMidYMin slice"
          className="block w-full"
          style={{
            height: H,
            WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
            maskImage: "linear-gradient(to bottom, black, transparent)",
          }}
        >
          <g stroke={`rgb(${PAPER} / .12)`} strokeWidth={1}>
            {Array.from({ length: 41 }, (_, i) => {
              const x = vx + (i - 20) * 140;
              return <line key={i} x1={vx + (i - 20) * 6} y1={0} x2={x} y2={H} />;
            })}
            {Array.from({ length: 14 }, (_, i) => {
              const y = H * (1 - 1 / (1 + i * 0.35)) * 1.6;
              return y < H ? <line key={i} x1={0} y1={y} x2={1440} y2={y} /> : null;
            })}
          </g>
        </svg>
        <div className="-mt-[150px]">
          <Content title="Your Club" />
        </div>
      </div>
    </div>
  );
}

// Radar rings: the next section is lit from a point on the seam with rings spreading out from it, one pinging.
function Rings() {
  return (
    <div>
      <div style={{ background: INK }}>
        <Content title="What You Get" cards />
      </div>
      <div className="relative overflow-hidden" style={{ background: STEP, borderTop: `1px solid rgb(${PAPER} / .1)` }}>
        <svg
          viewBox="0 0 1440 360"
          preserveAspectRatio="xMidYMin slice"
          className="absolute inset-x-0 top-0 h-[360px] w-full"
        >
          <defs>
            <radialGradient id="dv-ring-fade" cx="720" cy="0" r="700" gradientUnits="userSpaceOnUse">
              <stop offset={0} stopColor="white" />
              <stop offset={1} stopColor="white" stopOpacity={0} />
            </radialGradient>
            <mask id="dv-rings">
              <rect width="1440" height="360" fill="url(#dv-ring-fade)" />
            </mask>
          </defs>
          <g mask="url(#dv-rings)" fill="none" stroke={`rgb(${PAPER} / .14)`}>
            {Array.from({ length: 12 }, (_, i) => (
              <circle key={i} cx={720} cy={0} r={60 + i * 60} />
            ))}
            <circle
              cx={720}
              cy={0}
              stroke={`rgb(${PAPER} / .5)`}
              style={{ animation: "dv-ping 6s ease-out infinite" }}
            />
          </g>
        </svg>
        <Content title="Tour" />
      </div>
    </div>
  );
}

function Band({
  height,
  draw,
  top,
  bottom,
}: {
  height: number;
  draw: Parameters<typeof Canvas>[0]["draw"];
  top: string;
  bottom: string;
}) {
  return (
    <div>
      <div style={{ background: INK }}>
        <Content title={top} cards />
      </div>
      <Canvas height={height} draw={draw} />
      <div style={{ background: STEP }}>
        <Content title={bottom} />
      </div>
    </div>
  );
}

const concepts: { name: string; note: string; view: ReactNode }[] = [
  {
    name: "Blueprint Rails",
    note: "The layout's own structure shown: rails down the content edges, a rule between sections, a cross where they meet, and every other section dotted. What Vercel and Linear do.",
    view: <Rails />,
  },
  {
    name: "Halftone",
    note: "Dots of the next tone grow until they merge into it. The change itself is the pattern.",
    view: <Band height={200} draw={halftone} top="What You Get" bottom="Tour" />,
  },
  {
    name: "Ordered Dither",
    note: "Square pixels in a Bayer pattern, the way old instrument screens faded between two tones.",
    view: <Band height={180} draw={dither} top="Tour" bottom="Your Club" />,
  },
  {
    name: "Line Density",
    note: "Hairlines that thicken until they close, like scan lines or a print fade.",
    view: <Band height={180} draw={lines} top="Your Club" bottom="Start Flying" />,
  },
  {
    name: "Topography",
    note: "A full contour map spanning the seam, ink turning into slate underneath it. A real feature map, not a strip.",
    view: <Band height={300} draw={topo} top="What You Get" bottom="Tour" />,
  },
  {
    name: "Planet Limb",
    note: "The next section is the globe: its edge rises with the atmosphere's light and a faint graticule, like the live map.",
    view: <Limb />,
  },
  {
    name: "Apron Floor",
    note: "The next section starts at a lit horizon and a perspective grid runs toward you, fading as it comes.",
    view: <Floor />,
  },
  {
    name: "Radar",
    note: "Rings spread from a point on the seam into the next section, one ping travelling out every few seconds.",
    view: <Rings />,
  },
];

export function Dividers(): ReactElement {
  return (
    <main className="min-h-screen bg-ink pt-20 text-paper">
      <style>{keyframes}</style>
      <h1 className="display px-10 text-4xl">Section Transitions</h1>
      <p className="mt-2 px-10 text-muted">
        Each carries the page from an ink section into a lighter one, shown in use.
      </p>
      <div className="mt-12 flex flex-col gap-24">
        {concepts.map((concept, index) => (
          <section key={concept.name}>
            <div className="mx-auto mb-6 max-w-6xl px-10">
              <p className="text-sm text-paper/45">{String(index + 1).padStart(2, "0")}</p>
              <h2 className="display text-2xl">{concept.name}</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted">{concept.note}</p>
            </div>
            {concept.view}
          </section>
        ))}
      </div>
    </main>
  );
}
