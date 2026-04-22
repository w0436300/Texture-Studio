import type { TextureId } from "./textures";

const HD_PREFIX = "mat_";

/** `mat_{codePoint}_{textureId}` — permanent localStorage, no TTL. */
export function hdMaterialStorageKey(
  codePoint: number,
  textureId: TextureId,
): string {
  return `${HD_PREFIX}${codePoint}_${textureId}`;
}

export function readHdMaterialBase64(
  codePoint: number,
  textureId: TextureId,
): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(hdMaterialStorageKey(codePoint, textureId));
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

/** Store raw base64 (no `data:` prefix) or full data URL — reader accepts both. */
export function writeHdMaterialBase64(
  codePoint: number,
  textureId: TextureId,
  base64OrDataUrl: string,
): void {
  if (typeof window === "undefined") return;
  try {
    const v = base64OrDataUrl.startsWith("data:")
      ? base64OrDataUrl.replace(/^data:image\/\w+;base64,/, "")
      : base64OrDataUrl;
    localStorage.setItem(hdMaterialStorageKey(codePoint, textureId), v);
  } catch {
    /* quota */
  }
}

export function toDataUrlFromStored(stored: string): string {
  if (stored.startsWith("data:")) return stored;
  return `data:image/png;base64,${stored}`;
}
