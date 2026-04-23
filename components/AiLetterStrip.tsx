"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { GlyphUnit } from "@/lib/ascii-glyphs";
import { asciiGlyphUnits } from "@/lib/ascii-glyphs";
import {
  aiLetterSpriteStorageKey,
  compositeLetterSpritesRow,
  defaultSpritePose,
  isAiLetterSpriteMatted,
  markAiLetterSpriteMatted,
  mergeAiSpriteFixtureInMemory,
  prefetchAiSpriteFixtures,
  readAiLetterSpriteWithFixtures,
  spriteFixturesAreResolved,
  syncAiSpriteFixtureToDisk,
  toDataUrlFromSpriteStored,
  writeAiLetterSpriteBase64,
  type SpritePose,
} from "@/lib/ai-letter-sprite-cache";
import { removeLetterSpriteBackground } from "@/lib/letter-sprite-remove-bg";
import {
  canConsumeGeminiImageSlot,
  recordGeminiImageSuccess,
} from "@/lib/gemini-daily-limit";
import type { TextureId } from "@/lib/textures";

/** Slot placeholder when API is off or daily quota is exhausted. */
const DEMO_NO_CACHE = "demo-no-cache";

const ROTATE_SENS = 0.012;
/** CSS pixel space — slightly damped vs raw pointer delta. */
const DRAG_PIXEL_SENS = 0.55;
const SCALE_MIN = 0.35;
const SCALE_MAX = 3;

type SlotState = {
  url: string | null;
  loading: boolean;
  error: string | null;
};

type Props = {
  text: string;
  materialIdsPerChar: TextureId[];
  /** When false, do not auto-fetch (e.g. parent loading). */
  active: boolean;
  /**
   * When true, never call the sprite API — only show letters already in
   * localStorage (demo / cost control).
   */
  spriteCacheOnly: boolean;
  /** After each successful Gemini sprite response (counter already updated). */
  onGeminiQuotaConsumed?: () => void;
  /** Called after a new sprite is written to localStorage. */
  onSpriteStored?: () => void;
  className?: string;
};

export type AiLetterStripHandle = {
  getSpriteUrls: () => (string | null)[];
  getSpritePoses: () => SpritePose[];
  getCompositeDataUrl: () => Promise<string | null>;
  refetchMissing: () => void;
  /** Re-read `sprite_*` from localStorage into the strip (e.g. after JSON import). */
  reloadFromStorage: () => void;
};

function cacheKeyForAiSpriteLayout(
  units: GlyphUnit[],
  matIds: TextureId[],
): string {
  const sig = units.map((u) => `${u.sourceIndex}:${u.ch}`).join(",");
  const mats = units.map((u) => matIds[u.sourceIndex] ?? "clay").join(",");
  return `ts_ai_sprite_xform_v1|${sig}|${mats}`;
}

function readSpriteXformCache(
  key: string,
  n: number,
): SpritePose[] | null {
  if (typeof window === "undefined") return null;
  try {
    let s = localStorage.getItem(key);
    if (!s) {
      const legacy = sessionStorage.getItem(key);
      if (legacy) {
        try {
          localStorage.setItem(key, legacy);
          sessionStorage.removeItem(key);
        } catch {
          /* quota */
        }
        s = legacy;
      }
    }
    if (!s) return null;
    const j = JSON.parse(s) as SpritePose[];
    if (!Array.isArray(j) || j.length !== n) return null;
    for (const row of j) {
      if (
        typeof row?.x !== "number" ||
        typeof row?.y !== "number" ||
        typeof row?.rz !== "number" ||
        typeof row?.sc !== "number"
      ) {
        return null;
      }
    }
    return j;
  } catch {
    return null;
  }
}

function writeSpriteXformCache(key: string, poses: SpritePose[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(poses));
  } catch {
    /* quota */
  }
}

function clearSpriteXformCache(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* */
  }
}

/**
 * One Gemini image per visible ASCII glyph; PNG 缓存在 localStorage（`sprite_*`）。
 * 平移/旋转/缩放缓存在 localStorage（`ts_ai_sprite_xform_v1|…`），下次打开同一浏览器会恢复。
 */
export const AiLetterStrip = forwardRef<AiLetterStripHandle, Props>(
  function AiLetterStrip(
    {
      text,
      materialIdsPerChar,
      active,
      spriteCacheOnly,
      onGeminiQuotaConsumed,
      onSpriteStored,
      className,
    },
    ref,
  ) {
    const units = useMemo(
      () => asciiGlyphUnits(text, 40),
      [text],
    );

    const layoutKey = useMemo(
      () => cacheKeyForAiSpriteLayout(units, materialIdsPerChar),
      [units, materialIdsPerChar],
    );
    const layoutKeyRef = useRef(layoutKey);
    layoutKeyRef.current = layoutKey;

    const [poses, setPoses] = useState<SpritePose[]>(() =>
      units.map(() => defaultSpritePose()),
    );
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const posesRef = useRef(poses);
    posesRef.current = poses;
    const posePersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
      const saved = readSpriteXformCache(layoutKey, units.length);
      const next = saved ?? units.map(() => defaultSpritePose());
      posesRef.current = next;
      setPoses(next);
      setSelectedIndex(null);
    }, [layoutKey, units.length]);

    useEffect(() => {
      if (posePersistTimer.current) clearTimeout(posePersistTimer.current);
      posePersistTimer.current = setTimeout(() => {
        posePersistTimer.current = null;
        writeSpriteXformCache(layoutKeyRef.current, posesRef.current);
      }, 280);
      return () => {
        if (posePersistTimer.current) {
          clearTimeout(posePersistTimer.current);
          posePersistTimer.current = null;
        }
      };
    }, [layoutKey, poses]);

    const [slots, setSlots] = useState<SlotState[]>(() =>
      units.map(() => ({ url: null, loading: false, error: null })),
    );
    const slotsRef = useRef(slots);
    slotsRef.current = slots;
    const seqRef = useRef(0);
    /** Cancels one-shot rembg queue on layout/mode change. */
    const rembgSeqRef = useRef(0);

    const hydrateFromCache = useCallback(async () => {
      const fixturesOk = spriteFixturesAreResolved();
      const markDemoMissing = spriteCacheOnly && fixturesOk;
      setSlots(
        units.map((u) => {
          const tid = materialIdsPerChar[u.sourceIndex] ?? "clay";
          const cp = u.ch.codePointAt(0) ?? 0;
          const stored = readAiLetterSpriteWithFixtures(cp, tid);
          if (stored) {
            return {
              url: toDataUrlFromSpriteStored(stored),
              loading: false,
              error: null,
            };
          }
          if (markDemoMissing) {
            return {
              url: null,
              loading: false,
              error: DEMO_NO_CACHE,
            };
          }
          return { url: null, loading: false, error: null };
        }),
      );
    }, [units, materialIdsPerChar, spriteCacheOnly]);

    useEffect(() => {
      let alive = true;
      void prefetchAiSpriteFixtures().then(() => {
        if (!alive) return;
        void hydrateFromCache();
      });
      return () => {
        alive = false;
      };
    }, [hydrateFromCache]);

    // One-shot rembg for old cache entries: each sprite key gets processed once.
    useEffect(() => {
      if (!active) return;
      const mySeq = ++rembgSeqRef.current;
      void (async () => {
        for (let i = 0; i < units.length; i++) {
          if (rembgSeqRef.current !== mySeq) return;
          const u = units[i];
          if (!u) continue;
          const tid = materialIdsPerChar[u.sourceIndex] ?? "clay";
          const cp = u.ch.codePointAt(0) ?? 0;
          if (isAiLetterSpriteMatted(cp, tid)) continue;
          const raw = readAiLetterSpriteWithFixtures(cp, tid);
          if (!raw) continue;
          // Yield between letters so UI stays interactive.
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
          if (rembgSeqRef.current !== mySeq) return;
          try {
            const out = await removeLetterSpriteBackground(raw, "image/png");
            if (rembgSeqRef.current !== mySeq) return;
            writeAiLetterSpriteBase64(cp, tid, out);
            markAiLetterSpriteMatted(cp, tid);
            mergeAiSpriteFixtureInMemory(aiLetterSpriteStorageKey(cp, tid), out);
            setSlots((prev) => {
              if (i >= prev.length) return prev;
              const next = [...prev];
              next[i] = { url: toDataUrlFromSpriteStored(out), loading: false, error: null };
              return next;
            });
          } catch {
            // Do not mark on failure; next load may retry once more.
          }
        }
      })();
      return () => {
        rembgSeqRef.current++;
      };
    }, [active, units, materialIdsPerChar]);

    const runFetchMissing = useCallback(async () => {
      if (!active || units.length === 0) return;
      const mySeq = ++seqRef.current;
      await prefetchAiSpriteFixtures();
      if (seqRef.current !== mySeq) return;
      await hydrateFromCache();
      if (seqRef.current !== mySeq) return;
      for (let i = 0; i < units.length; i++) {
        if (seqRef.current !== mySeq) return;
        const u = units[i];
        if (!u) continue;
        const tid = materialIdsPerChar[u.sourceIndex] ?? "clay";
        const cp = u.ch.codePointAt(0) ?? 0;
        if (readAiLetterSpriteWithFixtures(cp, tid)) continue;

        if (spriteCacheOnly) {
          continue;
        }

        if (!canConsumeGeminiImageSlot()) {
          setSlots((s) => {
            const next = [...s];
            next[i] = {
              ...next[i]!,
              url: null,
              loading: false,
              error: DEMO_NO_CACHE,
            };
            return next;
          });
          continue;
        }

        setSlots((s) => {
          const next = [...s];
          next[i] = { ...next[i]!, url: null, loading: true, error: null };
          return next;
        });
        try {
          const res = await fetch("/api/generateLetterSprite", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ glyph: u.ch, textureId: tid }),
          });
          const data = (await res.json()) as {
            ok?: boolean;
            error?: string;
            base64?: string;
            mimeType?: string;
          };
          if (seqRef.current !== mySeq) return;
          if (!res.ok || !data.ok || !data.base64) {
            throw new Error(data.error ?? res.statusText);
          }
          const mime =
            typeof data.mimeType === "string" && data.mimeType.length > 0
              ? data.mimeType
              : "image/png";
          const cutBase64 = await removeLetterSpriteBackground(
            data.base64,
            mime,
          );
          writeAiLetterSpriteBase64(cp, tid, cutBase64);
          markAiLetterSpriteMatted(cp, tid);
          const sk = aiLetterSpriteStorageKey(cp, tid);
          mergeAiSpriteFixtureInMemory(sk, cutBase64);
          void syncAiSpriteFixtureToDisk(sk, cutBase64).catch(() => {
            /* disk / prod: expected to fail on read-only hosts */
          });
          const url = toDataUrlFromSpriteStored(cutBase64);
          recordGeminiImageSuccess();
          onGeminiQuotaConsumed?.();
          setSlots((s) => {
            const next = [...s];
            next[i] = { url, loading: false, error: null };
            return next;
          });
          onSpriteStored?.();
        } catch (e: unknown) {
          if (seqRef.current !== mySeq) return;
          const msg = e instanceof Error ? e.message : "生成失败";
          setSlots((s) => {
            const next = [...s];
            next[i] = { url: null, loading: false, error: msg };
            return next;
          });
        }
      }
    }, [
      active,
      units,
      materialIdsPerChar,
      hydrateFromCache,
      onSpriteStored,
      spriteCacheOnly,
      onGeminiQuotaConsumed,
    ]);

    useEffect(() => {
      if (!active) return;
      void runFetchMissing();
    }, [active, runFetchMissing]);

    const spriteRowUrls = useMemo(
      () => slots.map((s) => s.url),
      [slots],
    );

    const dragRef = useRef<{
      index: number;
      mode: "move" | "rotate";
      pointerId: number;
      lastX: number;
      lastY: number;
    } | null>(null);

    const onPointerDown = useCallback(
      (index: number, e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(index);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* */
        }
        dragRef.current = {
          index,
          mode: e.shiftKey ? "rotate" : "move",
          pointerId: e.pointerId,
          lastX: e.clientX,
          lastY: e.clientY,
        };
      },
      [],
    );

    const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const dx = e.clientX - d.lastX;
      const dy = e.clientY - d.lastY;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      setPoses((prev) => {
        const next = [...prev];
        const p = { ...next[d.index]! };
        if (d.mode === "move") {
          p.x += dx * DRAG_PIXEL_SENS;
          p.y += dy * DRAG_PIXEL_SENS;
        } else {
          p.rz += dx * ROTATE_SENS;
        }
        next[d.index] = p;
        posesRef.current = next;
        return next;
      });
    }, []);

    const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      dragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
      writeSpriteXformCache(layoutKey, posesRef.current);
    }, [layoutKey]);

    const onWheelStrip = useCallback(
      (e: React.WheelEvent<HTMLDivElement>) => {
        if (!e.shiftKey) return;
        if (selectedIndex === null) return;
        e.preventDefault();
        const idx = selectedIndex;
        setPoses((prev) => {
          const next = [...prev];
          const p = { ...next[idx]! };
          p.sc = Math.min(
            SCALE_MAX,
            Math.max(SCALE_MIN, p.sc * Math.exp(-e.deltaY * 0.0018)),
          );
          next[idx] = p;
          posesRef.current = next;
          return next;
        });
      },
      [selectedIndex],
    );

    const onDoubleClickStrip = useCallback(() => {
      clearSpriteXformCache(layoutKey);
      const next = units.map(() => defaultSpritePose());
      posesRef.current = next;
      setPoses(next);
      setSelectedIndex(null);
    }, [layoutKey, units.length]);

    useImperativeHandle(
      ref,
      () => ({
        getSpriteUrls: () => spriteRowUrls,
        getSpritePoses: () =>
          posesRef.current.map((p) => ({ x: p.x, y: p.y, rz: p.rz, sc: p.sc })),
        getCompositeDataUrl: async () => {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          const urls = slotsRef.current.map((s) => s.url);
          if (!urls.length || urls.some((u) => !u)) return null;
          const poses = posesRef.current.map((p) => ({
            x: p.x,
            y: p.y,
            rz: p.rz,
            sc: p.sc,
          }));
          return await compositeLetterSpritesRow(urls, 10, poses);
        },
        refetchMissing: () => {
          void runFetchMissing();
        },
        reloadFromStorage: () => {
          void prefetchAiSpriteFixtures().then(() => hydrateFromCache());
        },
      }),
      [spriteRowUrls, runFetchMissing, hydrateFromCache],
    );

    return (
      <div
        className={[
          "flex min-h-[min(52vh,520px)] w-full flex-col rounded-2xl border border-ink-line bg-white",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div
          className="relative min-h-[min(48vh,480px)] w-full flex-1 touch-none px-2 py-4 outline-none"
          onWheel={onWheelStrip}
          tabIndex={0}
          role="application"
          aria-label="AI 单字拼贴画布"
        >
          <div className="flex h-full min-h-[420px] w-full items-end justify-center gap-1 overflow-visible">
            {units.map((u, i) => {
              const tid = materialIdsPerChar[u.sourceIndex] ?? "clay";
              const s = slots[i];
              const p = poses[i] ?? defaultSpritePose();
              const selected = selectedIndex === i;
              return (
                <div
                  key={`${u.sourceIndex}-${u.ch}-${i}`}
                  className="relative flex min-h-0 min-w-0 max-w-[min(22vw,220px)] flex-1 flex-col items-center justify-end"
                >
                  <div
                    className={[
                      "flex max-h-[min(42vh,420px)] min-h-[80px] w-full cursor-grab touch-none select-none items-end justify-center rounded-lg",
                      selected ? "ring-2 ring-ink/30 ring-offset-2" : "",
                    ].join(" ")}
                    style={{
                      transformOrigin: "50% 100%",
                      transform: `translate(${p.x}px, ${p.y}px) rotate(${p.rz}rad) scale(${p.sc})`,
                    }}
                    onPointerDown={(e) => onPointerDown(i, e)}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    onDoubleClick={(e) => e.stopPropagation()}
                  >
                    {s?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.url}
                        alt={u.ch}
                        className="max-h-[min(42vh,420px)] w-auto max-w-full object-contain drop-shadow-sm"
                        draggable={false}
                      />
                    ) : s?.loading ? (
                      <div className="ts-pulse rounded-lg bg-ink-surface px-4 py-8 text-[11px] text-ink-muted">
                        {u.ch}
                      </div>
                    ) : spriteCacheOnly && !spriteFixturesAreResolved() ? (
                      <div
                        className="ts-pulse rounded-lg bg-ink-surface px-3 py-8 text-center text-[10px] text-ink-muted"
                        title="正在读取本机与 public/ai-letter-sprite-fixtures/sprites.json"
                      >
                        {u.ch}
                        <br />
                        加载缓存…
                      </div>
                    ) : s?.error === DEMO_NO_CACHE ? (
                      <div
                        className="max-w-[120px] rounded-lg border border-dashed border-ink-line bg-ink-surface/40 px-2 py-2 text-center text-[10px] text-ink-muted"
                        title="演示 / 额度：仅显示已缓存的单字"
                      >
                        {u.ch}
                        <br />
                        无缓存
                      </div>
                    ) : s?.error ? (
                      <div
                        className="max-w-[120px] rounded-lg border border-red-200 bg-red-50 px-2 py-2 text-center text-[10px] text-red-700"
                        title={s.error}
                      >
                        {u.ch}
                        <br />
                        失败
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-ink-line px-4 py-8 text-[11px] text-ink-muted">
                        {u.ch}
                      </div>
                    )}
                  </div>
                  <span className="pointer-events-none mt-1 max-w-[100px] truncate text-[9px] text-black/40">
                    {tid}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <p
          className="cursor-default border-t border-ink-line/60 px-3 py-2 text-center text-[10px] text-black/35 select-none"
          onDoubleClick={onDoubleClickStrip}
          title="双击此说明栏可还原全部位置/角度/缩放"
        >
          点选单字 · 拖动平移 · Shift+拖动旋转 · Shift+滚轮缩放 · 生成后自动抠底并写入本机，下次打开可恢复 ·
          <span className="underline decoration-black/20">双击本行还原布局</span>
        </p>
        {units.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-ink-muted">
            无可用 ASCII 字母
          </p>
        )}
      </div>
    );
  },
);
