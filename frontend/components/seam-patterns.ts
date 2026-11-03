export const smooth = (t: number): number => t * t * (3 - 2 * t);

// Dots of the current fill style, growing down the band until they merge into it.
export function halftone(c: CanvasRenderingContext2D, w: number, h: number): void {
  const cell = 9;
  for (let y = cell / 2; y < h + cell; y += cell) {
    const r = smooth(Math.min(1, y / h)) * cell * 0.75;
    if (r < 0.3) continue;
    for (let x = ((y / cell) % 2) * (cell / 2); x < w + cell; x += cell) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  }
}

// Hairlines of the current fill style, thickening down the band until they close into it.
export function lines(c: CanvasRenderingContext2D, w: number, h: number): void {
  const gap = 8;
  for (let y = 0; y < h; y += gap) c.fillRect(0, y, w, Math.max(0.5, smooth(y / h) * gap));
}
