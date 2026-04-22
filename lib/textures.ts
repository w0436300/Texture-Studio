export type TextureId =
  | "random"
  | "mixed"
  | "clay"
  | "glass"
  | "plush"
  | "chrome"
  | "moss"
  | "ceramic"
  | "jelly"
  | "latex"
  | "paper"
  | "felt"
  | "marble"
  | "holographic"
  | "wood"
  | "gold"
  | "wax"
  | "stone"
  | "rubber"
  | "crystal"
  | "bubble"
  | "neon";

export interface Texture {
  id: TextureId;
  /** Chinese label shown to the user */
  zh: string;
  /** English label shown to the user */
  en: string;
  /** Short visual description fed to the prompt engine */
  descriptor: string;
  /** A representative palette used by the mock renderer */
  palette: {
    base: string;
    highlight: string;
    shadow: string;
    accent?: string;
  };
  /** Mock renderer strategy — how the SVG fallback should look */
  mockStyle:
    | "soft-plastic"
    | "transparent-glass"
    | "fuzzy-fiber"
    | "polished-metal"
    | "organic-moss"
    | "glossy-porcelain"
    | "translucent-jelly"
    | "rubbery-matte"
    | "paper-flat"
    | "felt-grain"
    | "veined-stone"
    | "iridescent"
    | "wood-grain"
    | "lustrous-gold"
    | "waxy-drip"
    | "rough-stone"
    | "rubber-soft"
    | "faceted-crystal"
    | "bubblegum"
    | "neon-glow";
}

/**
 * 有机 / 强微观纹理：工程上优先用 **AI 生成方形贴图** 贴到挤出 mesh，
 * 结果按 `mat_{codePoint}_{textureId}` 永久缓存在 localStorage；其余材质由
 * Three.js PBR 直接渲染（$0）。
 */
const AI_TEXTURE_MATERIAL_IDS = new Set<TextureId>([
  "moss",
  "plush",
  "felt",
  "wood",
  "marble",
  "wax",
]);

/** `random` / `mixed` 为入口态；判断时请用 resolve 后的具体 id。 */
export function isAiTextureMaterial(id: TextureId): boolean {
  if (id === "random" || id === "mixed") return false;
  return AI_TEXTURE_MATERIAL_IDS.has(id);
}

export const TEXTURES: Texture[] = [
  {
    id: "random",
    zh: "随机材质",
    en: "Random",
    descriptor: "a surprise high-end material, chosen for dramatic effect",
    palette: { base: "#ffffff", highlight: "#fafafa", shadow: "#d9d9db" },
    mockStyle: "soft-plastic",
  },
  {
    id: "mixed",
    zh: "混合材质",
    en: "Mixed",
    descriptor:
      "each letter rendered as a distinct inflated 3D sculpture in a different premium physical material — e.g. glossy candy jelly, soft clay, knitted jute rope, living moss, pearl chrome, iridescent holographic glass with water droplets, fluffy fur, polished chrome balloon, dark yarn — composed like a curated material-library sampler on a clean off-white studio background",
    palette: { base: "#f2f2f2", highlight: "#ffffff", shadow: "#c9c9cc" },
    mockStyle: "iridescent",
  },
  {
    id: "clay",
    zh: "粘土",
    en: "Clay",
    descriptor:
      "soft matte clay with inflated, pillow-like 3D volumes and gentle studio lighting",
    palette: { base: "#f0c9b5", highlight: "#fde1d2", shadow: "#c79077" },
    mockStyle: "soft-plastic",
  },
  {
    id: "glass",
    zh: "玻璃",
    en: "Glass",
    descriptor:
      "clear, thick polished glass with subtle refraction, caustics and a crisp specular highlight",
    palette: { base: "#d8ecff", highlight: "#ffffff", shadow: "#8ab8e0" },
    mockStyle: "transparent-glass",
  },
  {
    id: "plush",
    zh: "绒毛",
    en: "Plush",
    descriptor:
      "fluffy plush fabric with tiny fibers, soft shadows and a toy-like 3D form",
    palette: { base: "#ffd1dc", highlight: "#ffeaf1", shadow: "#d68aa0" },
    mockStyle: "fuzzy-fiber",
  },
  {
    id: "chrome",
    zh: "金属",
    en: "Chrome",
    descriptor:
      "mirror-finish chrome metal with crisp reflections of a neutral studio environment",
    palette: { base: "#c7ccd1", highlight: "#ffffff", shadow: "#4e5560" },
    mockStyle: "polished-metal",
  },
  {
    id: "moss",
    zh: "苔藓",
    en: "Moss",
    descriptor:
      "living moss surface with thousands of tiny green stalks, soft diffuse light",
    palette: { base: "#6c8f4a", highlight: "#a9c772", shadow: "#3b5a24" },
    mockStyle: "organic-moss",
  },
  {
    id: "ceramic",
    zh: "陶瓷",
    en: "Ceramic",
    descriptor:
      "glossy porcelain ceramic with smooth rounded edges and a soft ceramic glaze",
    palette: { base: "#f3f3f0", highlight: "#ffffff", shadow: "#c4c4bf" },
    mockStyle: "glossy-porcelain",
  },
  {
    id: "jelly",
    zh: "果冻",
    en: "Jelly",
    descriptor:
      "translucent colorful jelly with subsurface scattering, soft jiggly form",
    palette: { base: "#ff8fb1", highlight: "#ffd8e4", shadow: "#c84f77" },
    mockStyle: "translucent-jelly",
  },
  {
    id: "latex",
    zh: "乳胶",
    en: "Latex",
    descriptor:
      "matte rubbery latex with a slight sheen and soft rubber lighting",
    palette: { base: "#1a1a1a", highlight: "#3a3a3a", shadow: "#0a0a0a" },
    mockStyle: "rubbery-matte",
  },
  {
    id: "paper",
    zh: "纸艺",
    en: "Paper",
    descriptor:
      "folded paper craft with crisp folds, layered cutouts and paper fiber texture",
    palette: { base: "#fafaf4", highlight: "#ffffff", shadow: "#d7d4c6" },
    mockStyle: "paper-flat",
  },
  {
    id: "felt",
    zh: "毛毡",
    en: "Felt",
    descriptor:
      "pressed felt fabric with gentle fiber texture and soft stitched edges",
    palette: { base: "#d98c5f", highlight: "#f3b28a", shadow: "#9e5a33" },
    mockStyle: "felt-grain",
  },
  {
    id: "marble",
    zh: "大理石",
    en: "Marble",
    descriptor:
      "polished white marble with elegant grey veining and a glossy finish",
    palette: { base: "#eceae6", highlight: "#ffffff", shadow: "#9b9a95" },
    mockStyle: "veined-stone",
  },
  {
    id: "holographic",
    zh: "全息",
    en: "Holographic",
    descriptor:
      "iridescent holographic foil shifting through pastel rainbow hues with a mirror sheen",
    palette: { base: "#c8b8ff", highlight: "#b2f5ea", shadow: "#7c6cff", accent: "#ffb1de" },
    mockStyle: "iridescent",
  },
  {
    id: "wood",
    zh: "木纹",
    en: "Wood",
    descriptor:
      "natural oak wood with warm grain, soft matte varnish and woodgrain rings",
    palette: { base: "#c39062", highlight: "#e6b988", shadow: "#8c5a30" },
    mockStyle: "wood-grain",
  },
  {
    id: "gold",
    zh: "黄金",
    en: "Gold",
    descriptor:
      "lustrous polished gold with warm highlights and rich amber reflections",
    palette: { base: "#e6b94a", highlight: "#fff1bd", shadow: "#8a651c" },
    mockStyle: "lustrous-gold",
  },
  {
    id: "wax",
    zh: "蜡质",
    en: "Wax",
    descriptor:
      "soft melting candle wax with gentle translucency, drips and waxy surface",
    palette: { base: "#f3d9c0", highlight: "#fff0df", shadow: "#c59970" },
    mockStyle: "waxy-drip",
  },
  {
    id: "stone",
    zh: "岩石",
    en: "Stone",
    descriptor:
      "rough natural stone with chiseled edges, speckled mineral surface",
    palette: { base: "#9a9791", highlight: "#c4c2bd", shadow: "#57544f" },
    mockStyle: "rough-stone",
  },
  {
    id: "rubber",
    zh: "橡胶",
    en: "Rubber",
    descriptor:
      "soft squishy rubber with a matte finish and gentle rounded edges",
    palette: { base: "#ff6b4a", highlight: "#ff9b80", shadow: "#b23f24" },
    mockStyle: "rubber-soft",
  },
  {
    id: "crystal",
    zh: "水晶",
    en: "Crystal",
    descriptor:
      "faceted crystal with sharp geometric planes, refractive caustics and prismatic light",
    palette: { base: "#b0e0ff", highlight: "#ffffff", shadow: "#5a7fb0", accent: "#ffd6ff" },
    mockStyle: "faceted-crystal",
  },
  {
    id: "bubble",
    zh: "泡泡糖",
    en: "Bubblegum",
    descriptor:
      "bubblegum pink inflated balloon material with glossy highlights and playful volumes",
    palette: { base: "#ff8ac0", highlight: "#ffd6ea", shadow: "#c24f8d" },
    mockStyle: "bubblegum",
  },
  {
    id: "neon",
    zh: "霓虹",
    en: "Neon",
    descriptor:
      "glowing neon tube with vibrant electric hue, soft bloom and dark background glow",
    palette: { base: "#ff3df0", highlight: "#ffffff", shadow: "#8a00ff", accent: "#00e5ff" },
    mockStyle: "neon-glow",
  },
];

export function getTexture(id: TextureId): Texture {
  return TEXTURES.find((t) => t.id === id) ?? TEXTURES[0];
}

/** Concrete textures (no "random"/"mixed" meta entries). */
export const CONCRETE_TEXTURES: Texture[] = TEXTURES.filter(
  (t) => t.id !== "random" && t.id !== "mixed",
);

/**
 * Curated subset used by the "mixed" preset.
 * These are the materials that read most clearly as distinct premium
 * 3D objects in a single composition (per the design reference): candy,
 * clay, moss, chrome, fur, iridescent glass, yarn-like fabric, etc.
 */
const MIXED_POOL_IDS: TextureId[] = [
  "jelly",
  "clay",
  "moss",
  "chrome",
  "plush",
  "holographic",
  "felt",
  "bubble",
  "ceramic",
  "gold",
  "wax",
  "crystal",
  "marble",
];

export const MIXED_POOL: Texture[] = MIXED_POOL_IDS.map((id) => getTexture(id));

export function pickRandomTexture(): Texture {
  return CONCRETE_TEXTURES[
    Math.floor(Math.random() * CONCRETE_TEXTURES.length)
  ];
}

function pickFromPool(pool: Texture[]): Texture {
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Build a per-character assignment from a pool, biased so that
 * adjacent characters use different materials (matches the reference
 * aesthetic where every letter reads as a visibly distinct material).
 */
function assignDistinctPerChar(count: number, pool: Texture[]): Texture[] {
  const out: Texture[] = [];
  for (let i = 0; i < count; i++) {
    let pick = pickFromPool(pool);
    let guard = 0;
    while (pool.length > 1 && out[i - 1] && pick.id === out[i - 1].id && guard++ < 8) {
      pick = pickFromPool(pool);
    }
    out.push(pick);
  }
  return out;
}

/** Resolve a selection (which may be `random` or `mixed`) into what to render. */
export function resolveTextures(
  selection: TextureId,
  text: string,
): { primary: Texture; perChar?: Texture[] } {
  if (selection === "random") {
    return { primary: pickRandomTexture() };
  }
  if (selection === "mixed") {
    const chars = Array.from(text);
    const perChar = assignDistinctPerChar(chars.length, MIXED_POOL);
    return { primary: perChar[0] ?? pickFromPool(MIXED_POOL), perChar };
  }
  return { primary: getTexture(selection) };
}
