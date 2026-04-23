import { TEXTURE_PICKER_IDS, TEXTURES, type TextureId } from "./textures";

const SPRITE_PREFIX = "sprite_";
const SPRITE_MATTED_PREFIX = "sprite_matted_v1_";

/** Per-letter 2D layout for AI 单字拼贴 (matches UI transform). */
export type SpritePose = {
  x: number;
  y: number;
  rz: number;
  sc: number;
};

export function defaultSpritePose(): SpritePose {
  return { x: 0, y: 0, rz: 0, sc: 1 };
}

/** Full-letter Gemini renders — separate from HD square tiles (`mat_*`). Persisted in localStorage. */
export function aiLetterSpriteStorageKey(
  codePoint: number,
  textureId: TextureId,
): string {
  return `${SPRITE_PREFIX}${codePoint}_${textureId}`;
}

export function readAiLetterSpriteBase64(
  codePoint: number,
  textureId: TextureId,
): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(
      aiLetterSpriteStorageKey(codePoint, textureId),
    );
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function writeAiLetterSpriteBase64(
  codePoint: number,
  textureId: TextureId,
  base64OrDataUrl: string,
): void {
  if (typeof window === "undefined") return;
  try {
    const v = base64OrDataUrl.startsWith("data:")
      ? base64OrDataUrl.replace(/^data:image\/\w+;base64,/, "")
      : base64OrDataUrl;
    localStorage.setItem(
      aiLetterSpriteStorageKey(codePoint, textureId),
      v,
    );
  } catch {
    /* quota */
  }
}

function spriteMattedStorageKey(codePoint: number, textureId: TextureId): string {
  return `${SPRITE_MATTED_PREFIX}${codePoint}_${textureId}`;
}

/** True once this `(codePoint, textureId)` has finished one successful rembg pass. */
export function isAiLetterSpriteMatted(
  codePoint: number,
  textureId: TextureId,
): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(spriteMattedStorageKey(codePoint, textureId)) === "1";
  } catch {
    return false;
  }
}

/** Mark one `(codePoint, textureId)` as having completed rembg at least once. */
export function markAiLetterSpriteMatted(
  codePoint: number,
  textureId: TextureId,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(spriteMattedStorageKey(codePoint, textureId), "1");
  } catch {
    /* quota */
  }
}

const SPRITE_FIXTURE_KEY_RE = /^sprite_\d+_[a-zA-Z0-9]+$/;

/** In-repo JSON under `public/ai-letter-sprite-fixtures/sprites.json` (for git + local test). */
let spriteFixtureEntries: Record<string, string> | null = null;
let spriteFixturePrefetchPromise: Promise<void> | null = null;

export async function prefetchAiSpriteFixtures(): Promise<void> {
  if (typeof window === "undefined") return;
  if (spriteFixtureEntries !== null) return;
  if (!spriteFixturePrefetchPromise) {
    spriteFixturePrefetchPromise = (async () => {
      try {
        const res = await fetch("/ai-letter-sprite-fixtures/sprites.json", {
          cache: "no-store",
        });
        if (!res.ok) {
          spriteFixtureEntries = {};
          return;
        }
        const data = (await res.json()) as { entries?: unknown };
        const e = data.entries;
        spriteFixtureEntries =
          e && typeof e === "object" && !Array.isArray(e)
            ? (e as Record<string, string>)
            : {};
      } catch {
        spriteFixtureEntries = {};
      }
    })();
  }
  await spriteFixturePrefetchPromise;
}

/** True after the first `prefetchAiSpriteFixtures` finished (even if entries are empty). */
export function spriteFixturesAreResolved(): boolean {
  return spriteFixtureEntries !== null;
}

/** localStorage first, then fixtures file (after `prefetchAiSpriteFixtures`). */
export function readAiLetterSpriteWithFixtures(
  codePoint: number,
  textureId: TextureId,
): string | null {
  const fromLs = readAiLetterSpriteBase64(codePoint, textureId);
  if (fromLs) return fromLs;
  const key = aiLetterSpriteStorageKey(codePoint, textureId);
  const f = spriteFixtureEntries?.[key];
  return f && f.length > 0 ? f : null;
}

export function mergeAiSpriteFixtureInMemory(
  key: string,
  base64OrDataUrl: string,
): void {
  if (typeof window === "undefined") return;
  if (!SPRITE_FIXTURE_KEY_RE.test(key)) return;
  const v = base64OrDataUrl.startsWith("data:")
    ? base64OrDataUrl.replace(/^data:image\/\w+;base64,/, "")
    : base64OrDataUrl;
  if (spriteFixtureEntries === null) spriteFixtureEntries = {};
  spriteFixtureEntries[key] = v;
}

/**
 * Merge one sprite into `public/ai-letter-sprite-fixtures/sprites.json` via API.
 * Works in `next dev` or when `ALLOW_SPRITE_DISK_WRITE=1` (e.g. self-hosted).
 * Serverless hosts without a writable disk will return 403 — localStorage still holds the image.
 */
export async function syncAiSpriteFixtureToDisk(
  key: string,
  base64OrDataUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === "undefined") return { ok: false, error: "no window" };
  if (!SPRITE_FIXTURE_KEY_RE.test(key)) {
    return { ok: false, error: "invalid key" };
  }
  const v = base64OrDataUrl.startsWith("data:")
    ? base64OrDataUrl.replace(/^data:image\/\w+;base64,/, "")
    : base64OrDataUrl;
  try {
    const res = await fetch("/api/saveAiSpriteFixtures", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, base64: v }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? res.statusText };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network" };
  }
}

export function toDataUrlFromSpriteStored(stored: string): string {
  if (stored.startsWith("data:")) return stored;
  return `data:image/png;base64,${stored}`;
}

/** All `sprite_*` keys in localStorage (persistent across sessions). */
export function listSpriteStorageKeys(): string[] {
  if (typeof window === "undefined") return [];
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(SPRITE_PREFIX)) keys.push(k);
    }
  } catch {
    /* */
  }
  return keys.sort();
}

export function countStoredSpriteImages(): number {
  return listSpriteStorageKeys().length;
}

const SPRITE_CACHE_META_IDS = new Set<TextureId>(["random", "mixed", "spriteCache"]);

function textureIdsPickerThenCatalog(): TextureId[] {
  const out: TextureId[] = [];
  const seen = new Set<TextureId>();
  const push = (id: TextureId) => {
    if (SPRITE_CACHE_META_IDS.has(id)) return;
    if (!TEXTURES.some((t) => t.id === id)) return;
    if (seen.has(id)) return;
    seen.add(id);
    out.push(id);
  };
  for (const id of TEXTURE_PICKER_IDS) push(id as TextureId);
  for (const t of TEXTURES) push(t.id);
  return out;
}

function parseSpriteStorageKey(
  key: string,
): { cp: number; tid: TextureId } | null {
  if (!key.startsWith(SPRITE_PREFIX)) return null;
  const rest = key.slice(SPRITE_PREFIX.length);
  const m = rest.match(/^(\d+)_(.+)$/);
  if (!m?.[1] || !m[2]) return null;
  const cp = Number(m[1]);
  const tidStr = m[2];
  if (!Number.isFinite(cp) || !TEXTURES.some((t) => t.id === tidStr)) {
    return null;
  }
  return { cp, tid: tidStr as TextureId };
}

/** localStorage + in-memory fixture keys (fixtures must be prefetched for fixture keys). */
export function listAllSpriteStorageKeysMerged(): string[] {
  if (typeof window === "undefined") return [];
  const s = new Set(listSpriteStorageKeys());
  if (spriteFixtureEntries) {
    for (const k of Object.keys(spriteFixtureEntries)) {
      if (k.startsWith(SPRITE_PREFIX)) s.add(k);
    }
  }
  return [...s];
}

/**
 * All concrete texture ids that have a cached sprite for this code point, in stable
 * order (picker order first, then any remaining by catalog order).
 */
export function listCachedTextureIdsForGlyph(codePoint: number): TextureId[] {
  if (typeof window === "undefined") return [];
  const found = new Set<TextureId>();
  for (const key of listAllSpriteStorageKeysMerged()) {
    const p = parseSpriteStorageKey(key);
    if (!p || p.cp !== codePoint) continue;
    if (!SPRITE_CACHE_META_IDS.has(p.tid)) found.add(p.tid);
  }
  if (found.size === 0) return [];
  const order = textureIdsPickerThenCatalog();
  const out: TextureId[] = [];
  for (const tid of order) {
    if (found.has(tid)) out.push(tid);
  }
  const rest = [...found]
    .filter((tid) => !out.includes(tid))
    .sort((a, b) => a.localeCompare(b));
  out.push(...rest);
  return out;
}

/**
 * @param shuffleKey  Changes on each Generate in 缓存材质 mode so a different
 *                    cached material can be selected when several exist.
 */
export function pickCachedTextureIdForGlyph(
  codePoint: number,
  shuffleKey: number,
  charIndex: number,
): TextureId | null {
  const ids = listCachedTextureIdsForGlyph(codePoint);
  if (ids.length === 0) return null;
  if (ids.length === 1) return ids[0] ?? null;
  const h =
    (shuffleKey * 0x9e3779b9) ^
    (charIndex * 0x1f1f1f1f) ^
    (codePoint * 0x85ebca6b);
  const idx = (h >>> 0) % ids.length;
  return ids[idx] ?? null;
}

/**
 * Same length / indexing as `materialIdsForText` for `threeBaseText`:
 * each character index gets a concrete id chosen from any cached sprite for that glyph.
 * @param shuffleKey  Increment in the app when 缓存材质 Generate succeeds, so
 *                    repeated generates rotate among available cached materials.
 */
export function materialIdsSpriteCacheMode(
  text: string,
  shuffleKey = 0,
): TextureId[] {
  const t = (text || "Sample").trim() || "Sample";
  const chars = Array.from(t);
  return chars.map((ch, j) => {
    if (ch === " " || ch === "\t") return "chrome" as TextureId;
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 0x20 || cp > 0x7e) return "chrome";
    return pickCachedTextureIdForGlyph(cp, shuffleKey, j) ?? ("chrome" as TextureId);
  });
}

/** Map key → raw base64 for backup / migration. */
export function exportSpriteLocalStorageEntries(): Record<string, string> {
  const entries: Record<string, string> = {};
  if (typeof window === "undefined") return entries;
  try {
    for (const k of listSpriteStorageKeys()) {
      const v = localStorage.getItem(k);
      if (v) entries[k] = v;
    }
  } catch {
    /* */
  }
  return entries;
}

/** Download all cached AI letter PNGs as one JSON file. */
export function downloadAiSpriteBackupFile(): void {
  if (typeof window === "undefined") return;
  const entries = exportSpriteLocalStorageEntries();
  const payload = {
    version: 1,
    kind: "texture-studio-ai-sprites",
    exportedAt: new Date().toISOString(),
    entryCount: Object.keys(entries).length,
    entries,
  };
  const blob = new Blob([JSON.stringify(payload)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `texture-studio-ai-sprites-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type ImportSpriteBackupResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

/** Restore entries from exported JSON string. */
export function importAiSpriteBackupJson(raw: string): ImportSpriteBackupResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, error: "不是合法 JSON" };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: "JSON 格式无效" };
  }
  const obj = parsed as { entries?: unknown };
  const entries = obj.entries;
  if (!entries || typeof entries !== "object") {
    return { ok: false, error: "缺少 entries 字段" };
  }
  let count = 0;
  for (const [k, v] of Object.entries(entries as Record<string, unknown>)) {
    if (typeof k !== "string" || !k.startsWith(SPRITE_PREFIX)) continue;
    if (typeof v !== "string" || v.length === 0) continue;
    try {
      localStorage.setItem(k, v);
      count++;
    } catch {
      return { ok: false, error: "localStorage 已满或不可用" };
    }
  }
  return { ok: true, count };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = url;
  });
}

type Corner = { x: number; y: number };

function cornersRotatedScaled(
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  rz: number,
  sc: number,
): Corner[] {
  const pts: Corner[] = [
    { x: -hw * sc, y: -hh * sc },
    { x: hw * sc, y: -hh * sc },
    { x: hw * sc, y: hh * sc },
    { x: -hw * sc, y: hh * sc },
  ];
  const cos = Math.cos(rz);
  const sin = Math.sin(rz);
  return pts.map((p) => ({
    x: cx + p.x * cos - p.y * sin,
    y: cy + p.x * sin + p.y * cos,
  }));
}

/**
 * Composite letter PNGs left-to-right; optional `poses` (same length as `dataUrls`)
 * applies translate / rotate / scale around each image center (bottom-aligned row).
 */
export async function compositeLetterSpritesRow(
  dataUrls: (string | null | undefined)[],
  padding = 10,
  poses?: SpritePose[] | null,
): Promise<string | null> {
  type Entry = { i: number; img: HTMLImageElement; pose: SpritePose; w: number; h: number };
  const entries: Entry[] = [];
  for (let i = 0; i < dataUrls.length; i++) {
    const url = dataUrls[i];
    if (!url) continue;
    const img = await loadImage(url);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const pose =
      poses && poses[i]
        ? poses[i]!
        : defaultSpritePose();
    entries.push({ i, img, pose, w, h });
  }
  if (entries.length === 0) return null;

  const maxH = Math.max(...entries.map((e) => e.h));
  let xCursor = padding;
  const layouts = entries.map((e) => {
    const left = xCursor;
    const yTop = padding + (maxH - e.h) / 2;
    const cx = left + e.w / 2 + e.pose.x;
    const cy = yTop + e.h / 2 + e.pose.y;
    xCursor += e.w + padding;
    return { ...e, left, yTop, cx, cy };
  });

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const expand = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const L of layouts) {
    const hw = L.w / 2;
    const hh = L.h / 2;
    const cs = cornersRotatedScaled(L.cx, L.cy, hw, hh, L.pose.rz, L.pose.sc);
    for (const c of cs) expand(c.x, c.y);
  }
  const margin = 24;
  const cw = Math.min(8192, Math.ceil(maxX - minX + margin * 2));
  const ch = Math.min(4096, Math.ceil(maxY - minY + margin * 2));
  if (!Number.isFinite(cw) || !Number.isFinite(ch) || cw < 4 || ch < 4) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, cw, ch);
  const ox = -minX + margin;
  const oy = -minY + margin;

  for (const L of layouts) {
    const cx = L.cx + ox;
    const cy = L.cy + oy;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(L.pose.rz);
    ctx.scale(L.pose.sc, L.pose.sc);
    ctx.drawImage(L.img, -L.w / 2, -L.h / 2, L.w, L.h);
    ctx.restore();
  }
  return canvas.toDataURL("image/png");
}
