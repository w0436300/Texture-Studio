import { Texture, TextureId, resolveTextures } from "./textures";

export type LayoutMode = "stacked" | "inline";

export interface PromptInput {
  text: string;
  texture: TextureId;
  layout: LayoutMode;
  /** Optional freeform accent color cue */
  accent?: string;
}

export interface BuiltPrompt {
  prompt: string;
  primary: Texture;
  perChar?: Texture[];
  seed: number;
}

const STYLE_GUIDE = [
  "Ultra high-end 3D typographic poster in the style of a curated material-library showcase",
  "each letterform is an inflated, chunky, sculptural 3D object with soft rounded edges and believable weight",
  "every letter is rendered as a distinct premium physical material (candy, clay, knitted rope, moss, pearl chrome, iridescent glass, fluffy fur, polished metal, yarn, etc.) so the word reads like a curated material sampler",
  "transparent background with alpha channel (no solid backdrop, no paper, no wall, no floor plane)",
  "soft diffuse studio lighting from above, gentle ambient occlusion, subtle self-shadowing only",
  "physically based rendering, crisp specular highlights appropriate to each material, realistic subsurface scattering where relevant",
  "tight framing around the word with minimal top/bottom empty space",
  "no extra decoration, no watermark, no frame, no background props, no text other than the subject word",
].join(", ");

const QUALITY = [
  "8k, extremely sharp",
  "octane / cinema4d / blender cycles render feel",
  "crisp silhouettes, generous negative space",
  "editorial poster look, magazine cover quality",
  "tactile, believable, photoreal materials",
].join(", ");

function layoutInstruction(layout: LayoutMode, text: string): string {
  const chars = Array.from(text);
  if (layout === "stacked" || chars.length > 6) {
    return `Arrange the characters as a centered multi-line sculptural composition — letters sitting and gently leaning on each other like physical 3D objects on a studio table, clearly legible, with varied scale and a little playful rotation so each material reads`;
  }
  return `Arrange the characters on a single clean centered row, evenly spaced, each letter a separate physical 3D object sitting on the same invisible surface, with small variations in scale and rotation so every material reads clearly`;
}

function charsToLine(text: string, perChar?: Texture[]): string {
  const chars = Array.from(text);
  if (!perChar || perChar.length === 0) return `the word "${text}"`;
  const parts = chars.map((ch, i) => {
    const t = perChar[i] ?? perChar[perChar.length - 1];
    return `"${ch}" in ${t.en.toLowerCase()} (${t.descriptor})`;
  });
  return `the word "${text}" where ${parts.join("; ")}`;
}

export function buildPrompt(input: PromptInput): BuiltPrompt {
  const text = (input.text || "Sample").trim() || "Sample";
  const { primary, perChar } = resolveTextures(input.texture, text);
  const seed = Math.floor(Math.random() * 1_000_000);

  const subject = perChar
    ? charsToLine(text, perChar)
    : `the word "${text}" rendered entirely in ${primary.en.toLowerCase()} — ${primary.descriptor}`;

  const layoutLine = layoutInstruction(input.layout, text);

  const mixedPoster =
    input.texture === "mixed"
      ? [
          `[Mixed poster] Each letter must read as a completely different premium physical object in one hero shot (curated material-library typography): e.g. cable-knit wool, hyper-real living moss, mirror-polished chrome, fluffy plush fleece, glossy jelly plastic — chunky inflated 3D letterforms, same row, editorial product lighting.`,
          `[Background] Prefer a clean pure white (#ffffff) infinite studio backdrop (high-key) so materials pop like a magazine cover; if alpha is required use full transparency instead — never busy props or floor clutter.`,
        ].join(" ")
      : "";

  const threeNote =
    "[Rendering] Per-glyph Three.js extruded text with MeshPhysicalMaterial; " +
    "materials moss/plush/knit/wood may use a separate square albedo tile from an image API once per (Unicode code point, material id), cached permanently client-side; chrome/gold/glass/ice/holographic/copper/chocolate/ceramic and all other catalog ids are real-time PBR only.";

  const prompt = [
    `[Style] ${STYLE_GUIDE}.`,
    `[Subject] ${subject}.`,
    mixedPoster,
    `[Layout] ${layoutLine}.`,
    `[Texture] emphasize authentic material detail, micro surface imperfections, believable lighting for the material.`,
    input.accent ? `[Color] subtle accent of ${input.accent}.` : `[Color] palette harmonized with the material, restrained and editorial.`,
    `[Quality] ${QUALITY}.`,
    threeNote,
  ]
    .filter(Boolean)
    .join("\n");

  return { prompt, primary, perChar, seed };
}
