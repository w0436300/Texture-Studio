/**
 * Client-side daily cap on Gemini **image** generations (letter sprites + HD tiles).
 * Stored in localStorage; resets at local calendar day change.
 */

const STORAGE_KEY = "ts_gemini_img_daily_v1";
export const GEMINI_IMAGE_DAILY_LIMIT = 10;

type Stored = { d: string; n: number };

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function readStored(): Stored {
  if (typeof window === "undefined") return { d: todayLocal(), n: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { d: todayLocal(), n: 0 };
    const j = JSON.parse(raw) as Stored;
    if (typeof j?.d !== "string" || typeof j?.n !== "number") {
      return { d: todayLocal(), n: 0 };
    }
    return j;
  } catch {
    return { d: todayLocal(), n: 0 };
  }
}

function writeStored(s: Stored): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* quota */
  }
}

export function getGeminiImageDailyCount(): number {
  const t = todayLocal();
  const s = readStored();
  return s.d === t ? s.n : 0;
}

export function isGeminiImageDailyLimitReached(): boolean {
  return getGeminiImageDailyCount() >= GEMINI_IMAGE_DAILY_LIMIT;
}

/** True if one more image call is allowed today. */
export function canConsumeGeminiImageSlot(): boolean {
  return getGeminiImageDailyCount() < GEMINI_IMAGE_DAILY_LIMIT;
}

/** Call after a successful Gemini image response (sprite or HD tile). */
export function recordGeminiImageSuccess(): void {
  const t = todayLocal();
  let s = readStored();
  if (s.d !== t) s = { d: t, n: 0 };
  s.n += 1;
  writeStored(s);
}

export function getGeminiImageDailySummary(): {
  date: string;
  used: number;
  limit: number;
  remaining: number;
} {
  const t = todayLocal();
  const s = readStored();
  const used = s.d === t ? s.n : 0;
  const limit = GEMINI_IMAGE_DAILY_LIMIT;
  return {
    date: t,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}
