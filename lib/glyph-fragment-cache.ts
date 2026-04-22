const VERSION = 1;
const PREFIX = "ts_glyph_frag_v";

/**
 * One cache key per (visible character, resolved texture id) — reused across
 * words and page loads so the same letter does not re-render its SVG fragment.
 */
export function makeGlyphFragmentCacheKey(
  codePoint: number,
  textureId: string,
): string {
  return `${PREFIX}${VERSION}|${codePoint}|${textureId}`;
}

function safeRead(key: string): string | null {
  if (typeof window === "undefined" || !window.sessionStorage) return null;
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWrite(key: string, fragment: string): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    sessionStorage.setItem(key, fragment);
  } catch {
    /* quota / private mode */
  }
}

export function getCachedGlyphFragment(
  key: string,
): string | null {
  const s = safeRead(key);
  return s && s.length > 0 ? s : null;
}

export function setCachedGlyphFragment(key: string, fragment: string): void {
  safeWrite(key, fragment);
}

export function createSessionGlyphCacheHooks(): {
  read: (key: string) => string | null;
  write: (key: string, fragment: string) => void;
} {
  return {
    read: getCachedGlyphFragment,
    write: setCachedGlyphFragment,
  };
}

export type MockFragmentCache = {
  fragmentRead?: (key: string) => string | null;
  fragmentWrite?: (key: string, fragment: string) => void;
};

export function toMockFragmentOptions(
  hooks: ReturnType<typeof createSessionGlyphCacheHooks>,
): MockFragmentCache {
  return {
    fragmentRead: hooks.read,
    fragmentWrite: hooks.write,
  };
}
