export type GlyphUnit = { ch: string; sourceIndex: number };

/** True if the string contains at least one printable ASCII glyph (for Three.js hero). */
export function hasPrintableAsciiGlyphs(raw: string, maxLen = 40): boolean {
  const t = raw.normalize("NFKC").slice(0, maxLen).trim() || "TEXT";
  for (const ch of t) {
    const c = ch.codePointAt(0)!;
    if (ch === " " || ch === "\t") continue;
    if (c >= 0x20 && c <= 0x7e) return true;
  }
  return false;
}

/** Printable ASCII glyphs for Three.js / HD tile pipeline (spaces skipped). */
export function asciiGlyphUnits(raw: string, maxLen: number): GlyphUnit[] {
  const t = raw.normalize("NFKC").slice(0, maxLen).trim() || "TEXT";
  const out: GlyphUnit[] = [];
  let i = 0;
  for (const ch of t) {
    const c = ch.codePointAt(0)!;
    if (ch === " " || ch === "\t") {
      i++;
      continue;
    }
    if (c < 0x20 || c > 0x7e) {
      i++;
      continue;
    }
    out.push({ ch, sourceIndex: i });
    i++;
  }
  return out.length > 0 ? out : [{ ch: "T", sourceIndex: 0 }];
}
