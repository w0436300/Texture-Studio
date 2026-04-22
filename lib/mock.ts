import { makeGlyphFragmentCacheKey } from "./glyph-fragment-cache";
import { Texture, TextureId, getTexture, resolveTextures } from "./textures";

export interface MockInput {
  text: string;
  texture: TextureId;
  layout: "stacked" | "inline";
  seed?: number;
  /**
   * When set, `renderGlyph` is skipped for cache hits; fragments are still
   * key-stable per (code point, texture id).
   */
  fragmentRead?: (key: string) => string | null;
  fragmentWrite?: (key: string, fragment: string) => void;
  /**
   * When each entry matches a visible character, reuse server-resolved
   * materials (avoids desync on mixed/random when re-building on the client).
   */
  perCharTextureIds?: TextureId[];
}

/** Serializable scene for client-side per-glyph drag (mock / SVG path only). */
export interface MockInteractiveGlyph {
  index: number;
  char: string;
  /** Resolved texture id for this glyph (for session fragment cache). */
  materialId: string;
  layoutX: number;
  layoutY: number;
  /** Local Y for rotate(θ, 0, anchorY) — typographic center vs baseline. */
  rotateAnchorY: number;
  /** Inner SVG markup (safe: only server-built & escaped char content). */
  fragment: string;
}

export interface MockInteractiveScene {
  viewWidth: number;
  viewHeight: number;
  defs: string;
  glyphs: MockInteractiveGlyph[];
  label: string;
}

/**
 * Layout + defs + per-letter SVG fragments (glyphs drawn at local 0,0 then
 * placed with `<g transform="translate(x,y)">` on the client or in flat SVG).
 */
export function buildMockInteractiveScene(input: MockInput): MockInteractiveScene {
  const text = (input.text || "Sample").trim() || "Sample";
  const chars = Array.from(text);
  const { primary, perChar } = (() => {
    if (
      input.perCharTextureIds &&
      input.perCharTextureIds.length === chars.length
    ) {
      const fromIds = input.perCharTextureIds.map((id) => getTexture(id));
      return { primary: fromIds[0] ?? getTexture("clay"), perChar: fromIds };
    }
    return resolveTextures(input.texture, text);
  })();
  const seed = input.seed ?? Math.floor(Math.random() * 1_000_000);
  void seed;

  const width = 1024;
  const rows = input.layout === "stacked" ? splitIntoRows(chars) : [chars];

  const maxCols = Math.max(...rows.map((r) => r.length));
  const fontSize = Math.floor((width * 0.92) / Math.max(maxCols, 1) / 0.6);
  const lineHeight = Math.floor(fontSize * 1.04);
  const totalTextHeight = lineHeight * rows.length;
  const padY = Math.floor(fontSize * 0.35);
  const height = totalTextHeight + padY * 2;
  const startY = padY + fontSize * 0.85;
  const rotateAnchorY = -fontSize * 0.35;

  const defs: string[] = [];
  const filterIds = new Set<string>();
  const defBlockSeen = new Set<string>();
  const glyphs: MockInteractiveGlyph[] = [];

  const advance = fontSize * 0.6;
  rows.forEach((row, ri) => {
    const y = startY + ri * lineHeight;
    const rowWidth = row.length * advance;
    let x = (width - rowWidth) / 2 + advance / 2;
    row.forEach((ch, ci) => {
      const globalIndex = rowIndexOffset(rows, ri) + ci;
      const tex = perChar ? perChar[globalIndex] ?? primary : primary;
      const cp = ch.codePointAt(0) ?? 0;
      const defKey = `glyph${cp}-${tex.id}`;
      ensureTextureDefs(defs, filterIds, defBlockSeen, tex, defKey);
      const cacheKey = makeGlyphFragmentCacheKey(cp, tex.id);
      const fromCache = input.fragmentRead?.(cacheKey) ?? null;
      let fragment: string;
      if (fromCache) {
        fragment = fromCache;
      } else {
        fragment = renderGlyph(ch, 0, 0, fontSize, tex, defKey);
        input.fragmentWrite?.(cacheKey, fragment);
      }
      glyphs.push({
        index: globalIndex,
        char: ch,
        materialId: tex.id,
        layoutX: x,
        layoutY: y,
        rotateAnchorY,
        fragment,
      });
      x += advance;
    });
  });

  return {
    viewWidth: width,
    viewHeight: height,
    defs: defs.join("\n"),
    glyphs,
    label: text,
  };
}

/** One pass: shared by flat SVG, interactive scene, and fragment cache. */
export function buildMockOutput(input: MockInput): {
  scene: MockInteractiveScene;
  svg: string;
} {
  const scene = buildMockInteractiveScene(input);
  const text = (input.text || "Sample").trim() || "Sample";
  const body = scene.glyphs
    .map(
      (g) =>
        `<g transform="translate(${g.layoutX},${g.layoutY})">${g.fragment}</g>`,
    )
    .join("\n");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${scene.viewWidth} ${scene.viewHeight}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(text)}">
  <defs>
    ${scene.defs}
  </defs>
  ${body}
</svg>`;
  return { scene, svg };
}

/**
 * Build an SVG preview that approximates the generated poster.
 * Used when the real image API is unavailable (405, 500, network error,
 * or when TEXTURE_STUDIO_MOCK=1). Keeps the UX intact with no crash.
 */
export function renderMockSvg(input: MockInput): string {
  return buildMockOutput(input).svg;
}

function splitIntoRows(chars: string[]): string[][] {
  const n = chars.length;
  if (n <= 6) return [chars];
  if (n <= 12) {
    const mid = Math.ceil(n / 2);
    return [chars.slice(0, mid), chars.slice(mid)];
  }
  const perRow = Math.ceil(n / 3);
  return [
    chars.slice(0, perRow),
    chars.slice(perRow, perRow * 2),
    chars.slice(perRow * 2),
  ];
}

function rowIndexOffset(rows: string[][], ri: number): number {
  let acc = 0;
  for (let i = 0; i < ri; i++) acc += rows[i].length;
  return acc;
}

/**
 * Escape XML special characters so arbitrary user text renders safely
 * inside SVG <text> nodes.
 */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function ensureTextureDefs(
  defs: string[],
  filters: Set<string>,
  defBlockSeen: Set<string>,
  tex: Texture,
  key: string,
): void {
  if (defBlockSeen.has(key)) return;
  defBlockSeen.add(key);
  const { palette, mockStyle } = tex;
  const gradId = `${key}-grad`;

  switch (mockStyle) {
    case "soft-plastic":
    case "rubber-soft":
    case "bubblegum":
      defs.push(radial(gradId, palette.highlight, palette.base, palette.shadow));
      break;
    case "transparent-glass":
      defs.push(linear(gradId, palette.highlight, palette.base, palette.shadow));
      break;
    case "fuzzy-fiber":
      defs.push(radial(gradId, palette.highlight, palette.base, palette.shadow));
      addFilter(defs, filters, "fuzzyFilter", `
        <filter id="fuzzyFilter" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="2.4" numOctaves="1" seed="3"/>
          <feDisplacementMap in="SourceGraphic" scale="6"/>
        </filter>`);
      break;
    case "polished-metal":
    case "lustrous-gold":
      defs.push(`<linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${palette.highlight}"/>
        <stop offset="25%" stop-color="${palette.base}"/>
        <stop offset="55%" stop-color="${palette.shadow}"/>
        <stop offset="75%" stop-color="${palette.base}"/>
        <stop offset="100%" stop-color="${palette.highlight}"/>
      </linearGradient>`);
      break;
    case "organic-moss":
      defs.push(radial(gradId, palette.highlight, palette.base, palette.shadow));
      addFilter(defs, filters, "mossFilter", `
        <filter id="mossFilter" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="turbulence" baseFrequency="1.6" numOctaves="2" seed="7"/>
          <feDisplacementMap in="SourceGraphic" scale="3"/>
        </filter>`);
      break;
    case "glossy-porcelain":
      defs.push(radial(gradId, palette.highlight, palette.base, palette.shadow));
      break;
    case "translucent-jelly":
      defs.push(radial(gradId, palette.highlight, palette.base, palette.shadow));
      break;
    case "rubbery-matte":
      defs.push(radial(gradId, palette.highlight, palette.base, palette.shadow));
      break;
    case "paper-flat":
      defs.push(linear(gradId, palette.highlight, palette.base, palette.shadow));
      addFilter(defs, filters, "paperFilter", `
        <filter id="paperFilter">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="2"/>
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.12 0"/>
          <feComposite in2="SourceGraphic" operator="in"/>
        </filter>`);
      break;
    case "felt-grain":
      defs.push(radial(gradId, palette.highlight, palette.base, palette.shadow));
      addFilter(defs, filters, "feltFilter", `
        <filter id="feltFilter">
          <feTurbulence type="fractalNoise" baseFrequency="3.2" numOctaves="1" seed="4"/>
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0"/>
          <feComposite in2="SourceGraphic" operator="in"/>
        </filter>`);
      break;
    case "veined-stone":
      defs.push(linear(gradId, palette.highlight, palette.base, palette.shadow));
      addFilter(defs, filters, "veinFilter", `
        <filter id="veinFilter">
          <feTurbulence type="turbulence" baseFrequency="0.04 0.2" numOctaves="2" seed="1"/>
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0"/>
          <feComposite in2="SourceGraphic" operator="in"/>
        </filter>`);
      break;
    case "iridescent":
      defs.push(`<linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${palette.highlight}"/>
        <stop offset="35%" stop-color="${palette.base}"/>
        <stop offset="65%" stop-color="${palette.accent ?? palette.shadow}"/>
        <stop offset="100%" stop-color="${palette.shadow}"/>
      </linearGradient>`);
      break;
    case "wood-grain":
      defs.push(linear(gradId, palette.highlight, palette.base, palette.shadow));
      addFilter(defs, filters, "woodFilter", `
        <filter id="woodFilter">
          <feTurbulence type="turbulence" baseFrequency="0.02 0.6" numOctaves="2" seed="5"/>
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.3 0"/>
          <feComposite in2="SourceGraphic" operator="in"/>
        </filter>`);
      break;
    case "waxy-drip":
      defs.push(radial(gradId, palette.highlight, palette.base, palette.shadow));
      break;
    case "rough-stone":
      defs.push(radial(gradId, palette.highlight, palette.base, palette.shadow));
      addFilter(defs, filters, "stoneFilter", `
        <filter id="stoneFilter">
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="6"/>
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.3 0"/>
          <feComposite in2="SourceGraphic" operator="in"/>
        </filter>`);
      break;
    case "faceted-crystal":
      defs.push(`<linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${palette.highlight}"/>
        <stop offset="50%" stop-color="${palette.base}"/>
        <stop offset="100%" stop-color="${palette.accent ?? palette.shadow}"/>
      </linearGradient>`);
      break;
    case "neon-glow":
      defs.push(`<radialGradient id="${gradId}"><stop offset="0%" stop-color="${palette.highlight}"/><stop offset="60%" stop-color="${palette.base}"/><stop offset="100%" stop-color="${palette.shadow}"/></radialGradient>`);
      addFilter(defs, filters, "neonGlow", `
        <filter id="neonGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="8" result="b1"/>
          <feMerge><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>`);
      break;
  }
}

function addFilter(
  defs: string[],
  filters: Set<string>,
  id: string,
  svg: string,
): void {
  if (filters.has(id)) return;
  filters.add(id);
  defs.push(svg);
}

function radial(id: string, hi: string, base: string, sh: string): string {
  return `<radialGradient id="${id}" cx="35%" cy="30%" r="80%">
    <stop offset="0%" stop-color="${hi}"/>
    <stop offset="55%" stop-color="${base}"/>
    <stop offset="100%" stop-color="${sh}"/>
  </radialGradient>`;
}

function linear(id: string, hi: string, base: string, sh: string): string {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${hi}"/>
    <stop offset="50%" stop-color="${base}"/>
    <stop offset="100%" stop-color="${sh}"/>
  </linearGradient>`;
}

function renderGlyph(
  ch: string,
  x: number,
  y: number,
  size: number,
  tex: Texture,
  key: string,
): string {
  const fill = `url(#${key}-grad)`;
  const common = `font-family="Inter, system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif" font-weight="900" font-size="${size}" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="alphabetic"`;
  const shadowOffset = Math.max(2, size * 0.02);
  const shadow = `<text ${common} fill="rgba(0,0,0,0.18)" transform="translate(${shadowOffset},${shadowOffset * 2})">${esc(ch)}</text>`;

  switch (tex.mockStyle) {
    case "fuzzy-fiber":
      return `${shadow}<text ${common} fill="${fill}" filter="url(#fuzzyFilter)">${esc(ch)}</text>`;
    case "organic-moss":
      return `${shadow}<text ${common} fill="${fill}" filter="url(#mossFilter)">${esc(ch)}</text>`;
    case "paper-flat":
      return `${shadow}<text ${common} fill="${fill}">${esc(ch)}</text><text ${common} fill="black" filter="url(#paperFilter)" opacity="0.6">${esc(ch)}</text>`;
    case "felt-grain":
      return `${shadow}<text ${common} fill="${fill}">${esc(ch)}</text><text ${common} fill="black" filter="url(#feltFilter)" opacity="0.7">${esc(ch)}</text>`;
    case "veined-stone":
      return `${shadow}<text ${common} fill="${fill}">${esc(ch)}</text><text ${common} fill="black" filter="url(#veinFilter)" opacity="0.55">${esc(ch)}</text>`;
    case "wood-grain":
      return `${shadow}<text ${common} fill="${fill}">${esc(ch)}</text><text ${common} fill="${tex.palette.shadow}" filter="url(#woodFilter)" opacity="0.85">${esc(ch)}</text>`;
    case "rough-stone":
      return `${shadow}<text ${common} fill="${fill}">${esc(ch)}</text><text ${common} fill="black" filter="url(#stoneFilter)" opacity="0.65">${esc(ch)}</text>`;
    case "transparent-glass": {
      const hi = `<text ${common} fill="rgba(255,255,255,0.55)" transform="translate(${-size * 0.04},${-size * 0.05})">${esc(ch)}</text>`;
      return `${shadow}<text ${common} fill="${fill}" opacity="0.9">${esc(ch)}</text>${hi}`;
    }
    case "translucent-jelly": {
      const hi = `<text ${common} fill="rgba(255,255,255,0.5)" transform="translate(${-size * 0.05},${-size * 0.06})">${esc(ch)}</text>`;
      return `${shadow}<text ${common} fill="${fill}">${esc(ch)}</text>${hi}`;
    }
    case "neon-glow":
      return `<text ${common} fill="${fill}" filter="url(#neonGlow)">${esc(ch)}</text>`;
    case "lustrous-gold":
    case "polished-metal":
    case "iridescent":
    case "faceted-crystal":
    case "waxy-drip":
    case "glossy-porcelain":
    case "soft-plastic":
    case "rubber-soft":
    case "bubblegum":
    case "rubbery-matte":
    default:
      return `${shadow}<text ${common} fill="${fill}">${esc(ch)}</text>`;
  }
}

export function svgToDataUrl(svg: string): string {
  const encoded = Buffer.from(svg, "utf-8").toString("base64");
  return `data:image/svg+xml;base64,${encoded}`;
}

/** Browser-friendly data URL (used by client mock fallback). */
export function svgToDataUrlClient(svg: string): string {
  if (typeof btoa === "undefined") {
    return svgToDataUrl(svg);
  }
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}
