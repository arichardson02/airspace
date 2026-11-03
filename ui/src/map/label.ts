// Labels rendered once into small bitmaps. Text drawn straight onto a moving canvas snaps its glyphs to the pixel
// grid each frame and shimmers; a bitmap slides at sub-pixel positions as smoothly as the aircraft beside it, and
// drawing one is a single image copy instead of shaping text again.
const sprites = new Map<string, HTMLCanvasElement>();
const MAX_SPRITES = 1500;
const PAD = 2;
let watchingFonts = false;

export const paper = (alpha: number): string => `rgb(246 247 249 / ${alpha})`;

function sprite(text: string, font: string, alpha: number, ratio: number): HTMLCanvasElement | null {
  if (!watchingFonts) {
    // A label drawn before the font arrived would keep the fallback face, so they are drawn again once it has.
    watchingFonts = true;
    document.fonts.addEventListener("loadingdone", () => {
      sprites.clear();
    });
  }
  const key = `${font}|${alpha}|${ratio}|${text}`;
  let made = sprites.get(key);
  if (!made) {
    if (sprites.size >= MAX_SPRITES) sprites.clear();
    made = document.createElement("canvas");
    const paint = made.getContext("2d");
    if (!paint) return null;
    paint.font = font;
    const width = Math.ceil(paint.measureText(text).width) + PAD * 2;
    const height = Math.ceil(parseFloat(font.split(" ")[1]) * 1.4) + PAD * 2;
    made.width = width * ratio;
    made.height = height * ratio;
    paint.scale(ratio, ratio);
    paint.font = font;
    paint.textBaseline = "middle";
    paint.fillStyle = paper(alpha);
    paint.fillText(text, PAD, height / 2);
    sprites.set(key, made);
  }
  return made;
}

/** Draws `text` at (x, y), vertically centred, left-aligned from x or centred on it. */
export function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string,
  alpha: number,
  ratio: number,
  x: number,
  y: number,
  align: "left" | "center" = "left",
): void {
  const made = sprite(text, font, alpha, ratio);
  if (!made) return;
  const width = made.width / ratio;
  const height = made.height / ratio;
  ctx.drawImage(made, align === "center" ? x - width / 2 : x - PAD, y - height / 2, width, height);
}
