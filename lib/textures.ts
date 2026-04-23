export type TextureId =
  | "random"
  | "mixed"
  /** Per-glyph: use any cached AI letter sprite for that code point (localStorage + fixtures). */
  | "spriteCache"
  | "clay"
  | "glass"
  | "ice"
  | "plush"
  | "knit"
  | "chrome"
  | "copper"
  | "moss"
  | "ceramic"
  | "chocolate"
  | "jelly"
  | "latex"
  | "paper"
  | "felt"
  | "feltChrome"
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
 * **AI 贴图轨**（Gemini）：仅苔藓 / 毛绒 / 针织 / 木纹 — 生成方形 albedo tile
 * 贴到挤出 mesh，按 `mat_{codePoint}_{textureId}` 永久缓存在 localStorage；
 * **同一 (字母 Unicode 码点, 材质 id) 只请求一次**。
 *
 * **Three 轨**（秒出）：铬 / 金 / 玻璃 / 冰 / 镭射 / 铜 / 巧克力 / 陶瓷等其余
 * concrete id — `MeshPhysicalMaterial` PBR，不调图像生成 API。
 */
const AI_TEXTURE_MATERIAL_IDS = new Set<TextureId>([
  "moss",
  "plush",
  "knit",
  "wood",
]);

const META_TEXTURE_IDS = new Set<TextureId>(["random", "mixed", "spriteCache"]);

/** `random` / `mixed` / `spriteCache` 为入口态；判断时请用 resolve 后的具体 id。 */
export function isAiTextureMaterial(id: TextureId): boolean {
  if (META_TEXTURE_IDS.has(id)) return false;
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
    id: "spriteCache",
    zh: "缓存材质",
    en: "Cached letters",
    descriptor:
      "demo / cache mode: each glyph uses the first available cached AI letter sprite for that Unicode code point, regardless of which concrete material key it was stored under",
    palette: { base: "#e8e8ea", highlight: "#fafafa", shadow: "#c0c0c5" },
    mockStyle: "soft-plastic",
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
    id: "ice",
    zh: "冰",
    en: "Ice",
    descriptor:
      "crystal-clear frozen ice with subtle internal fractures, frosty micro-bubbles and cold blue-white refraction",
    palette: { base: "#d4f2ff", highlight: "#ffffff", shadow: "#7eb8d8" },
    mockStyle: "transparent-glass",
  },
  {
    id: "plush",
    zh: "毛绒",
    en: "Plush",
    descriptor:
      "fluffy plush fabric with tiny fibers, soft shadows and a toy-like 3D form",
    palette: { base: "#ffd1dc", highlight: "#ffeaf1", shadow: "#d68aa0" },
    mockStyle: "fuzzy-fiber",
  },
  {
    id: "knit",
    zh: "针织",
    en: "Knit",
    descriptor:
      "chunky wool cable-knit sweater macro: visible V-stitches, soft yarn fibers, gentle pilling, warm studio light",
    palette: { base: "#c4a88c", highlight: "#e8dcc8", shadow: "#7a5c44" },
    mockStyle: "fuzzy-fiber",
  },
  {
    id: "chrome",
    zh: "镀铬",
    en: "Chrome",
    descriptor:
      "mirror-finish chrome metal with crisp reflections of a neutral studio environment",
    palette: { base: "#c7ccd1", highlight: "#ffffff", shadow: "#4e5560" },
    mockStyle: "polished-metal",
  },
  {
    id: "copper",
    zh: "铜",
    en: "Copper",
    descriptor:
      "warm brushed copper metal with soft oxidation in recesses and rich specular rolls",
    palette: { base: "#c4723c", highlight: "#e8a878", shadow: "#6a3a22" },
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
    id: "chocolate",
    zh: "巧克力",
    en: "Chocolate",
    descriptor:
      "dark tempered chocolate with a satin snap, subtle cocoa bloom and soft edge rounding",
    palette: { base: "#3d2314", highlight: "#6b4530", shadow: "#1a0f08" },
    mockStyle: "waxy-drip",
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
    id: "feltChrome",
    zh: "毛毡镀铬边",
    en: "Felt + chrome rim",
    descriptor:
      "grey matte wool felt letterface with a mirror-polished chrome metal outline and bevel rim, studio macro",
    palette: { base: "#9a9a9e", highlight: "#e8e8ec", shadow: "#5a5a62" },
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
    zh: "镭射",
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

/** Concrete textures (no meta picker entries). */
export const CONCRETE_TEXTURES: Texture[] = TEXTURES.filter(
  (t) => !META_TEXTURE_IDS.has(t.id),
);

/**
 * Materials listed in the UI picker (cost-controlled subset).
 * Other ids still resolve via `getTexture` for legacy sessions.
 */
export const TEXTURE_PICKER_IDS: readonly TextureId[] = [
  "random",
  "mixed",
  "spriteCache",
  "chrome",
  "gold",
  "glass",
  "ceramic",
  "holographic",
  "moss",
  "wood",
  "jelly",
] as const;

export const TEXTURES_FOR_UI: Texture[] = TEXTURE_PICKER_IDS.map((id) =>
  getTexture(id),
);

export const TEXTURES_FOR_UI_CONCRETE: Texture[] = TEXTURES_FOR_UI.filter(
  (t) => !META_TEXTURE_IDS.has(t.id),
);

/**
 * Curated subset used by the "mixed" preset — aligned with the picker so
 * random assignments never pick a hidden material id.
 */
const MIXED_POOL_IDS: TextureId[] = TEXTURES_FOR_UI_CONCRETE.map((t) => t.id);

export const MIXED_POOL: Texture[] = MIXED_POOL_IDS.map((id) => getTexture(id));

export function pickRandomTexture(): Texture {
  const pool = TEXTURES_FOR_UI_CONCRETE;
  return pool[Math.floor(Math.random() * pool.length)]!;
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
  if (selection === "spriteCache") {
    const t = (text || "Sample").trim() || "Sample";
    const chars = Array.from(t);
    const fb = getTexture("chrome");
    return {
      primary: fb,
      perChar: chars.map(() => fb),
    };
  }
  return { primary: getTexture(selection) };
}
