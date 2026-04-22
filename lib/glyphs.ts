/**
 * Count of glyphs that would each get a 3D mesh in the future pipeline:
 * visible characters only (no ASCII whitespace; spaces are layout-only).
 * Aligns with docs/texture-studio-complete-logic.md soft-limit bands.
 */
export function countRenderGlyphs(input: string): number {
  let n = 0;
  for (const ch of input) {
    if (ch === " " || ch === "\n" || ch === "\r" || ch === "\t") continue;
    n += 1;
  }
  return n;
}

export type SoftGlyphBand = "ok" | "warn" | "heavy" | "extreme" | "over";

/**
 * G = countRenderGlyphs; bands match the logic doc (defaults).
 */
export function getGlyphSoftBand(g: number): SoftGlyphBand {
  if (g <= 0) return "ok";
  if (g <= 8) return "ok";
  if (g <= 12) return "warn";
  if (g <= 16) return "heavy";
  if (g <= 24) return "extreme";
  return "over";
}
