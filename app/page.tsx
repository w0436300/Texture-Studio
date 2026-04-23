"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TextureSelect } from "@/components/TextureSelect";
import {
  CopyIcon,
  CopyImageIcon,
  DownloadIcon,
  ShuffleIcon,
  SparklesIcon,
} from "@/components/Icons";
import { MockInteractivePreview } from "@/components/MockInteractivePreview";
import {
  AiLetterStrip,
  type AiLetterStripHandle,
} from "@/components/AiLetterStrip";
import {
  ThreeTextPreview,
  type ThreeTextPreviewHandle,
} from "@/components/ThreeTextPreview";
import {
  countStoredSpriteImages,
  downloadAiSpriteBackupFile,
  importAiSpriteBackupJson,
  materialIdsSpriteCacheMode,
  prefetchAiSpriteFixtures,
} from "@/lib/ai-letter-sprite-cache";
import {
  createSessionGlyphCacheHooks,
  toMockFragmentOptions,
} from "@/lib/glyph-fragment-cache";
import { asciiGlyphUnits, hasPrintableAsciiGlyphs } from "@/lib/ascii-glyphs";
import { buildMockOutput, svgToDataUrlClient } from "@/lib/mock";
import type { MockInteractiveScene } from "@/lib/mock";
import { countRenderGlyphs, getGlyphSoftBand } from "@/lib/glyphs";
import { writeHdMaterialBase64, readHdMaterialBase64 } from "@/lib/hd-material-cache";
import {
  canConsumeGeminiImageSlot,
  GEMINI_IMAGE_DAILY_LIMIT,
  getGeminiImageDailySummary,
  isGeminiImageDailyLimitReached,
  recordGeminiImageSuccess,
} from "@/lib/gemini-daily-limit";
import { buildPrompt } from "@/lib/prompt";
import {
  isAiTextureMaterial,
  TEXTURES_FOR_UI_CONCRETE,
  TextureId,
} from "@/lib/textures";

const SPRITE_CACHE_ONLY_PREF_KEY = "ts_gemini_cache_only_v1";

/**
 * One automatic preview fetch per tab session, unless the user hard-refreshes
 * the page (F5 / reload) — avoids re-calling the API on hot reload / remount.
 */
const PREVIEW_SEED_KEY = "ts_preview_seed_session_v1";

type Status = "idle" | "loading" | "success" | "warning" | "error";
type CopyRenderState = "idle" | "rendering" | "ready";

interface GenerateResponse {
  ok: boolean;
  source: "gemini" | "mock" | "three";
  reason?: string;
  warning?: string;
  prompt: string;
  /** Server sends the resolved id (e.g. random is expanded to a concrete). */
  texture: TextureId;
  perChar?: TextureId[];
  /** Text used when resolving `perChar` (stable after Generate). */
  resolvedText?: string;
  mimeType?: string;
  imageUrl?: string;
  /** Raw SVG markup, present when the server rendered via the mock path. */
  svg?: string;
  /** Per-glyph layout for draggable local mock preview (mock path only). */
  mockScene?: MockInteractiveScene;
}

const DEFAULT_TEXT = "HELLO";

type AsciiPreviewMode = "combined" | "aiSprites";

function applyClientMockWithCache(
  data: GenerateResponse,
  payload: { text: string; texture: TextureId; layout: "stacked" | "inline" },
  hooks: ReturnType<typeof createSessionGlyphCacheHooks>,
): GenerateResponse {
  if (data.source !== "mock") return data;
  const text = (payload.text || "Sample").trim() || "Sample";
  const charCount = Array.from(text).length;
  const { scene, svg } = buildMockOutput({
    text: payload.text,
    texture: data.texture,
    layout: payload.layout,
    perCharTextureIds:
      data.perChar && data.perChar.length === charCount
        ? data.perChar
        : undefined,
    ...toMockFragmentOptions(hooks),
  });
  return {
    ...data,
    mockScene: scene,
    svg,
    imageUrl: svgToDataUrlClient(svg),
  };
}

function materialIdsForText(
  text: string,
  result: Pick<GenerateResponse, "texture" | "perChar">,
): TextureId[] {
  const chars = Array.from(text.trim() || "Sample");
  const primary = result.texture;
  const pc = result.perChar;
  if (pc && pc.length === chars.length) {
    return pc;
  }
  return chars.map(() => primary);
}

function materialIdsForThreeRoute(
  text: string,
  result: Pick<GenerateResponse, "texture" | "perChar" | "source"> | null,
  spriteCacheShuffle: number,
): TextureId[] {
  if (!result || result.source !== "three") return [];
  if (result.texture === "spriteCache") {
    return materialIdsSpriteCacheMode(text, spriteCacheShuffle);
  }
  return materialIdsForText(text, result);
}

export default function Page() {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [texture, setTexture] = useState<TextureId>("mixed");
  const [layout] = useState<"stacked" | "inline">("inline");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const threePreviewRef = useRef<ThreeTextPreviewHandle>(null);
  const aiLetterStripRef = useRef<AiLetterStripHandle>(null);
  const aiSpriteImportRef = useRef<HTMLInputElement>(null);
  const [asciiPreviewMode, setAsciiPreviewMode] =
    useState<AsciiPreviewMode>("combined");
  const [storedSpriteCount, setStoredSpriteCount] = useState(0);
  /** Bumped after `prefetchAiSpriteFixtures` so `spriteCache` material ids recompute. */
  const [spriteFixtureEpoch, setSpriteFixtureEpoch] = useState(0);
  /** Bumped on each successful Generate in 缓存材质 to rotate among cached materials. */
  const [spriteCacheShuffle, setSpriteCacheShuffle] = useState(0);
  const [hdMatEpoch, setHdMatEpoch] = useState(0);
  const [hdMatting, setHdMatting] = useState<"off" | "pending">("off");
  /** When true, letter sprites + HD organic tiles never call Gemini (default). */
  const [spriteCacheOnly, setSpriteCacheOnly] = useState(true);
  const [geminiQuotaTick, setGeminiQuotaTick] = useState(0);
  const [copyRenderState, setCopyRenderState] = useState<CopyRenderState>("idle");

  const bumpGeminiQuotaUi = useCallback(() => {
    setGeminiQuotaTick((n) => n + 1);
  }, []);

  const geminiDaily = useMemo(
    () => getGeminiImageDailySummary(),
    [geminiQuotaTick],
  );

  const geminiImageDailyExhausted = isGeminiImageDailyLimitReached();
  /** Per-glyph SVG fragment cache (sessionStorage) for mock / local preview. */
  const glyphFragmentHooks = useMemo(
    () => createSessionGlyphCacheHooks(),
    [],
  );

  const [previewOffset, setPreviewOffset] = useState({ x: 0, y: 0 });
  const previewOffsetRef = useRef(previewOffset);
  previewOffsetRef.current = previewOffset;
  const previewDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const displayText = text.trim() || "Sample";

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (isGeminiImageDailyLimitReached()) {
        setSpriteCacheOnly(true);
        return;
      }
      setSpriteCacheOnly(localStorage.getItem(SPRITE_CACHE_ONLY_PREF_KEY) !== "0");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        SPRITE_CACHE_ONLY_PREF_KEY,
        spriteCacheOnly ? "1" : "0",
      );
    } catch {
      /* ignore */
    }
  }, [spriteCacheOnly]);

  useEffect(() => {
    if (geminiImageDailyExhausted) setSpriteCacheOnly(true);
  }, [geminiImageDailyExhausted, geminiQuotaTick]);

  const generate = useCallback(
    async (opts?: { textureOverride?: TextureId; textOverride?: string }) => {
      setStatus("loading");
      setErrorMsg(null);
      const payload = {
        text: opts?.textOverride ?? text,
        texture: opts?.textureOverride ?? texture,
        layout,
      };
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.status === 405) {
          const mock = await fetchMockClient(payload, glyphFragmentHooks);
          setResult(mock);
          if (payload.texture === "spriteCache" && mock.source === "three") {
            setSpriteCacheShuffle((n) => n + 1);
          }
          setStatus("warning");
          setErrorMsg("接口不可用,已展示本地预览 (405)");
          return;
        }
        if (!res.ok) {
          const mock = await fetchMockClient(payload, glyphFragmentHooks);
          setResult(mock);
          if (payload.texture === "spriteCache" && mock.source === "three") {
            setSpriteCacheShuffle((n) => n + 1);
          }
          setStatus("warning");
          setErrorMsg(`服务异常,已展示本地预览 (${res.status})`);
          return;
        }
        const data = (await res.json()) as GenerateResponse;
        const final = applyClientMockWithCache(data, payload, glyphFragmentHooks);
        setResult(final);
        if (payload.texture === "spriteCache" && final.source === "three") {
          setSpriteCacheShuffle((n) => n + 1);
        }
        if (data.source === "mock") {
          setStatus("warning");
          setErrorMsg(
            data.reason === "non_ascii_preview"
              ? "当前文案无可用 ASCII 字母,已使用本地 SVG 预览 (上方 3D 仅支持 ASCII)"
              : (data.warning ?? "已展示本地预览"),
          );
        } else {
          setStatus("success");
        }
      } catch (err: any) {
        const mock = await fetchMockClient(payload, glyphFragmentHooks);
        setResult(mock);
        if (payload.texture === "spriteCache" && mock.source === "three") {
          setSpriteCacheShuffle((n) => n + 1);
        }
        setStatus("warning");
        setErrorMsg("网络错误,已展示本地预览");
      }
    },
    [text, texture, layout, glyphFragmentHooks],
  );

  useEffect(() => {
    if (result?.source !== "three") {
      setAsciiPreviewMode("combined");
    }
  }, [result?.source]);

  const refreshStoredSpriteCount = useCallback(() => {
    if (typeof window === "undefined") return;
    setStoredSpriteCount(countStoredSpriteImages());
  }, []);

  const handleExportAiSprites = useCallback(() => {
    downloadAiSpriteBackupFile();
    showToast("已导出单字缓存 JSON");
  }, [showToast]);

  const handlePickImportAiSprites = useCallback(() => {
    aiSpriteImportRef.current?.click();
  }, []);

  const handleImportAiSpritesFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      try {
        const raw = await file.text();
        const res = importAiSpriteBackupJson(raw);
        if (!res.ok) {
          showToast(res.error);
          return;
        }
        refreshStoredSpriteCount();
        aiLetterStripRef.current?.reloadFromStorage();
        showToast(`已导入 ${res.count} 条单字缓存`);
      } catch {
        showToast("读取文件失败");
      }
    },
    [refreshStoredSpriteCount, showToast],
  );

  const runHdMaterialGeneration = useCallback(async () => {
    if (!result || result.source !== "three" || asciiPreviewMode !== "combined") {
      return;
    }
    if (spriteCacheOnly) {
      showToast("演示模式：未请求有机贴图接口");
      return;
    }
    const t = (result.resolvedText ?? displayText).trim() || "Sample";
    const ids = materialIdsForThreeRoute(t, result, spriteCacheShuffle);
    const units = asciiGlyphUnits(t, 40);
    const todo: { ch: string; tid: TextureId; cp: number }[] = [];
    for (const u of units) {
      const tid = ids[u.sourceIndex] ?? "clay";
      if (!isAiTextureMaterial(tid)) continue;
      const cp = u.ch.codePointAt(0) ?? 0;
      if (readHdMaterialBase64(cp, tid)) continue;
      todo.push({ ch: u.ch, tid, cp });
    }
    if (todo.length === 0) {
      showToast("有机材质贴图已全部缓存");
      return;
    }
    if (!canConsumeGeminiImageSlot()) {
      showToast("今日 Gemini 图像额度已用尽，仅可使用已缓存贴图");
      return;
    }
    const cap = getGeminiImageDailySummary().remaining;
    if (cap < todo.length) {
      showToast(`今日还可生成 ${cap} 张，将按顺序补全到额度用尽为止`);
    }
    setHdMatting("pending");
    try {
      let ok = 0;
      for (const item of todo) {
        if (!canConsumeGeminiImageSlot()) {
          showToast("今日额度已用尽，已停止补全");
          break;
        }
        const res = await fetch("/api/generateHdMaterial", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ glyph: item.ch, textureId: item.tid }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string; base64?: string };
        if (!res.ok || !data.ok || !data.base64) {
          throw new Error(data.error ?? res.statusText);
        }
        writeHdMaterialBase64(item.cp, item.tid, data.base64);
        recordGeminiImageSuccess();
        bumpGeminiQuotaUi();
        ok += 1;
        setHdMatEpoch((e) => e + 1);
      }
      if (ok > 0) {
        showToast(`已生成并缓存 ${ok} 张贴图`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "贴图生成失败";
      showToast(msg);
    } finally {
      setHdMatting("off");
    }
  }, [
    result,
    displayText,
    showToast,
    asciiPreviewMode,
    spriteCacheOnly,
    bumpGeminiQuotaUi,
    spriteCacheShuffle,
  ]);

  // Seed preview once per tab session; skip on HMR / remount so the preview
  // is not re-fetched when only code changes. Full browser reload clears the
  // "already seeded" flag so F5 can fetch again.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (nav?.type === "reload") {
      try {
        sessionStorage.removeItem(PREVIEW_SEED_KEY);
      } catch {
        /* ignore */
      }
    }
    try {
      if (sessionStorage.getItem(PREVIEW_SEED_KEY) === "1") {
        return;
      }
      sessionStorage.setItem(PREVIEW_SEED_KEY, "1");
    } catch {
      /* private mode, etc. */
    }
    void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- session gate; avoid re-run on generate identity
  }, []);

  const resetPreviewPosition = useCallback(() => {
    setPreviewOffset({ x: 0, y: 0 });
  }, []);

  const onPreviewPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const o = previewOffsetRef.current;
      const el = e.currentTarget;
      previewDragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origX: o.x,
        origY: o.y,
      };
      el.setPointerCapture(e.pointerId);
    },
    [],
  );

  const onPreviewPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = previewDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    setPreviewOffset({
      x: d.origX + (e.clientX - d.startX),
      y: d.origY + (e.clientY - d.startY),
    });
  }, []);

  const onPreviewPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = previewDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    previewDragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setPreviewOffset({ x: 0, y: 0 });
  }, [result?.imageUrl, result?.svg, result?.source]);

  const threeBaseText = useMemo(
    () => (result?.resolvedText ?? displayText).trim() || "Sample",
    [result?.resolvedText, displayText],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (result?.source !== "three" || result.texture !== "spriteCache") return;
    let alive = true;
    void prefetchAiSpriteFixtures().then(() => {
      if (alive) setSpriteFixtureEpoch((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, [result?.source, result?.texture, threeBaseText]);

  const materialIdsPerChar = useMemo((): TextureId[] => {
    return materialIdsForThreeRoute(
      threeBaseText,
      result,
      spriteCacheShuffle,
    );
  }, [result, threeBaseText, storedSpriteCount, spriteFixtureEpoch, spriteCacheShuffle]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (result?.source === "three" && asciiPreviewMode === "aiSprites") {
      setStoredSpriteCount(countStoredSpriteImages());
    }
  }, [result?.source, asciiPreviewMode, threeBaseText, materialIdsPerChar]);

  const needsAiTextureTiles = useMemo(() => {
    if (!result || result.source !== "three") return false;
    const units = asciiGlyphUnits(threeBaseText, 40);
    const ids = materialIdsForThreeRoute(
      threeBaseText,
      result,
      spriteCacheShuffle,
    );
    return units.some((u) =>
      isAiTextureMaterial(ids[u.sourceIndex] ?? "clay"),
    );
  }, [result, threeBaseText, spriteCacheShuffle]);

  const missingAiTileCount = useMemo(() => {
    if (!result || result.source !== "three") return 0;
    const units = asciiGlyphUnits(threeBaseText, 40);
    const ids = materialIdsForThreeRoute(
      threeBaseText,
      result,
      spriteCacheShuffle,
    );
    let n = 0;
    for (const u of units) {
      const tid = ids[u.sourceIndex] ?? "clay";
      if (!isAiTextureMaterial(tid)) continue;
      const cp = u.ch.codePointAt(0) ?? 0;
      if (!readHdMaterialBase64(cp, tid)) n++;
    }
    return n;
  }, [result, threeBaseText, hdMatEpoch, spriteCacheShuffle]);

  const glyphHint = useMemo(() => {
    const g = countRenderGlyphs(text);
    const band = getGlyphSoftBand(g);
    if (band === "ok") return null;
    if (band === "warn") {
      return `可见字符 ${g} 个(不含空格) — 已超出推荐 ≤8,后续 3D/高清会更吃性能,仍可继续生成`;
    }
    if (band === "heavy") {
      return `可见字符 ${g} 个 — 吃力档(13–16),建议缩短或开性能档(规划中)`;
    }
    if (band === "extreme") {
      return `可见字符 ${g} 个 — 极限档(17–24),帧率/内存风险显著升高`;
    }
    return `可见字符 ${g} 个 — 已超建议硬上限(24),请缩短后再试(3D 模式将更严格限制)`;
  }, [text]);

  const handleShuffle = useCallback(() => {
    const pool = TEXTURES_FOR_UI_CONCRETE;
    const pick = pool[Math.floor(Math.random() * pool.length)]!;
    setTexture(pick.id);
    generate({ textureOverride: pick.id });
  }, [generate]);

  const buildCurrentAiSpriteComposite = useCallback(async (): Promise<string | null> => {
    const snap = await aiLetterStripRef.current?.getCompositeDataUrl();
    return snap ?? null;
  }, []);

  const handleDownload = useCallback(() => {
    if (!result) {
      showToast("还没有可下载的图像");
      return;
    }
    if (result.source === "three") {
      if (asciiPreviewMode === "aiSprites") {
        void (async () => {
          const dataUrl = await buildCurrentAiSpriteComposite();
          if (!dataUrl) {
            showToast("仍有单字未生成完成,请稍后再下载");
            return;
          }
          const a = document.createElement("a");
          a.href = dataUrl;
          const safeName = (threeBaseText || "texture")
            .replace(/[^a-zA-Z0-9\u4e00-\u9fa5-_]+/g, "_")
            .slice(0, 40);
          a.download = `texture-ai-letters-${safeName}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          showToast("已下载拼贴图");
        })();
        return;
      }
      const dataUrl = threePreviewRef.current?.toDataURLpng();
      if (!dataUrl) {
        showToast("画布尚未就绪,请稍后再试");
        return;
      }
      const a = document.createElement("a");
      a.href = dataUrl;
      const safeName = (threeBaseText || "texture")
        .replace(/[^a-zA-Z0-9\u4e00-\u9fa5-_]+/g, "_")
        .slice(0, 40);
      a.download = `texture-${safeName}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast("已下载");
      return;
    }
    if (!result.imageUrl) {
      showToast("还没有可下载的图像");
      return;
    }
    const a = document.createElement("a");
    a.href = result.imageUrl;
    const safeName = (displayText || "texture")
      .replace(/[^a-zA-Z0-9\u4e00-\u9fa5-_]+/g, "_")
      .slice(0, 40);
    const ext = result.mimeType?.includes("svg") ? "svg" : "png";
    a.download = `texture-${safeName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast("已下载");
  }, [asciiPreviewMode, buildCurrentAiSpriteComposite, displayText, result, showToast, threeBaseText]);

  const handleCopyPrompt = useCallback(async () => {
    if (!result?.prompt) return;
    try {
      await navigator.clipboard.writeText(result.prompt);
      showToast("Prompt 已复制");
    } catch {
      showToast("复制失败,请手动选择");
    }
  }, [result, showToast]);

  const handleCopyImage = useCallback(async () => {
    setCopyRenderState("rendering");
    showToast("正在渲染最新姿态…");
    let url: string | null =
      result?.source === "three" && asciiPreviewMode === "combined"
        ? await (async () => {
            // Capture after one frame so latest drag/rotate/scale is flushed.
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            return threePreviewRef.current?.toDataURLpng() ?? null;
          })()
        : result?.source === "three" && asciiPreviewMode === "aiSprites"
          ? await buildCurrentAiSpriteComposite()
          : result?.imageUrl ?? null;
    if (!url) {
      setCopyRenderState("idle");
      showToast(
        result?.source === "three" && asciiPreviewMode === "aiSprites"
          ? "仍有单字未生成完成,无法复制"
          : "还没有可复制的图像",
      );
      return;
    }
    if (typeof ClipboardItem === "undefined") {
      setCopyRenderState("idle");
      showToast("当前浏览器不支持复制图片到剪贴板");
      return;
    }
    try {
      const png = await rasterizeToPngBlob(url);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      setCopyRenderState("ready");
      showToast("已渲染完成，可复制最新（本次已复制到剪贴板）");
    } catch {
      setCopyRenderState("idle");
      showToast("复制失败,请确认 HTTPS 或改用下载");
    }
  }, [asciiPreviewMode, buildCurrentAiSpriteComposite, result, showToast]);

  useEffect(() => {
    if (copyRenderState !== "ready") return;
    const t = setTimeout(() => setCopyRenderState("idle"), 1600);
    return () => clearTimeout(t);
  }, [copyRenderState]);

  const statusChip = useMemo(() => {
    switch (status) {
      case "loading":
        return { label: "生成中…", tone: "bg-ink-surface text-ink-muted" };
      case "success":
        return { label: "组合就绪", tone: "bg-ink text-white" };
      case "warning":
        return {
          label: "本地预览",
          tone: "bg-amber-50 text-amber-700 border border-amber-200",
        };
      case "error":
        return {
          label: "错误",
          tone: "bg-red-50 text-red-700 border border-red-200",
        };
      default:
        return { label: "就绪", tone: "bg-ink-surface text-ink-muted" };
    }
  }, [status]);

  const threeCompositorHint = useMemo(() => {
    if (result?.source !== "three") return null;
    return (
      <details className="mx-auto mt-3 max-w-xl text-center text-[11px] leading-relaxed text-ink-muted">
        <summary className="cursor-pointer select-none text-ink-muted hover:text-ink">
          单字组合 / 计费说明 — 点击展开
        </summary>
        <div className="mt-2 space-y-2 text-left text-ink-muted">
          <p>
            <strong className="font-medium text-ink">结合预览</strong>：Three.js
            逐字挤出，金属/果冻/陶瓷等为 PBR。苔藓、毛绒、针织、木纹走
            <strong className="font-medium text-ink">单字方形贴图</strong>
            （<code className="text-[10px]">mat_*</code> 缓存）。
          </p>
          <p>
            <strong className="font-medium text-ink">AI 单字拼贴</strong>：每字一张
            Gemini 透明底图，<code className="text-[10px]">sprite_*</code>{" "}
            本地缓存，组合导出整行 PNG。
          </p>
        </div>
      </details>
    );
  }, [result?.source]);

  return (
    <main className="relative min-h-screen w-full">
      {/* Top-left brand */}
      <div className="pointer-events-none absolute left-6 top-6 flex items-center gap-2">
        <div className="h-6 w-6 rounded-md bg-ink" />
        <div className="text-[13px] font-semibold tracking-tight">
          Texture Studio
        </div>
        <div className="ml-2 text-[12px] text-ink-muted">
          材质字效生成器
        </div>
      </div>

      {/* Top-right status chip */}
      <div className="absolute right-6 top-6 flex items-center gap-2">
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-medium ${statusChip.tone}`}
        >
          {statusChip.label}
        </span>
        {result?.source === "three" && (
          <span className="rounded-full border border-ink-line bg-white px-3 py-1 text-[11px] text-ink-muted">
            {asciiPreviewMode === "aiSprites" ? "AI 单字拼贴" : "Three.js"}
          </span>
        )}
      </div>

      {/* Preview canvas */}
      <section className="flex min-h-[44vh] items-center justify-center px-6 pt-16">
        <div className="ts-preview relative flex w-full max-w-[1100px] flex-col">
          {result?.mockScene ? (
            <div className="ts-preview-svg w-full">
              <MockInteractivePreview
                scene={result.mockScene}
                pulse={status === "loading"}
              />
            </div>
          ) : result?.source === "three" ? (
            <div className="flex w-full min-h-0 flex-col gap-3">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  className={[
                    "rounded-full border px-4 py-2 text-[12px] font-medium transition-colors",
                    asciiPreviewMode === "combined"
                      ? "border-ink bg-ink text-white"
                      : "border-ink-line bg-white text-ink-muted hover:border-ink hover:text-ink",
                  ].join(" ")}
                  onClick={() => setAsciiPreviewMode("combined")}
                >
                  结合预览
                </button>
                <button
                  type="button"
                  className={[
                    "rounded-full border px-4 py-2 text-[12px] font-medium transition-colors",
                    asciiPreviewMode === "aiSprites"
                      ? "border-ink bg-ink text-white"
                      : "border-ink-line bg-white text-ink-muted hover:border-ink hover:text-ink",
                  ].join(" ")}
                  onClick={() => setAsciiPreviewMode("aiSprites")}
                >
                  AI 单字拼贴
                </button>
              </div>
              <div className="mx-auto flex max-w-xl flex-col items-center gap-2 px-2">
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-ink-muted">
                  <span>
                    今日 Gemini 图像额度 {geminiDaily.used}/{geminiDaily.limit}
                  </span>
                  <label
                    className={[
                      "flex items-center gap-2",
                      geminiImageDailyExhausted
                        ? "cursor-not-allowed opacity-90"
                        : "cursor-pointer",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      className="rounded border-ink-line"
                      checked={spriteCacheOnly}
                      disabled={geminiImageDailyExhausted}
                      onChange={(e) => setSpriteCacheOnly(e.target.checked)}
                      title={
                        geminiImageDailyExhausted
                          ? "今日额度已用尽，仅可使用缓存"
                          : "勾选则不调用 Gemini 图像接口，仅显示已缓存的单字与有机贴图"
                      }
                    />
                    <span>仅使用已缓存（演示，不调图像接口）</span>
                  </label>
                </div>
                {geminiImageDailyExhausted && (
                  <p className="text-center text-[10px] text-amber-900/85">
                    已达今日上限，已自动进入仅缓存演示；次日按本机日期重置额度。
                  </p>
                )}
              </div>
              <p className="mx-auto max-w-xl text-center text-[11px] text-ink-muted">
                {asciiPreviewMode === "combined"
                  ? "Three 挤出 + PBR；有机材质可补方形贴图。"
                  : `默认不联网：仅展示已缓存的单字图。取消勾选「仅使用已缓存」且今日额度未用尽时才会请求 Gemini；每日最多 ${GEMINI_IMAGE_DAILY_LIMIT} 次图像生成（单字 + 有机贴图合计）。按「码点+材质」写入 localStorage（sprite_*），并在本机开发时合并到仓库文件 public/ai-letter-sprite-fixtures/sprites.json，便于 git 提交后他人拉取即测。当前 localStorage 内共 ${storedSpriteCount} 张。可导出/导入 JSON 备份。`}
              </p>
              {asciiPreviewMode === "combined" ? (
                <div
                  title="点选字母 · 拖动平移 · Shift+拖动旋转 · Shift+滚轮缩放 · 双击还原"
                  className="contents"
                >
                  <ThreeTextPreview
                    ref={threePreviewRef}
                    text={threeBaseText}
                    materialIdsPerChar={materialIdsPerChar}
                    hdMatEpoch={hdMatEpoch}
                  />
                  {needsAiTextureTiles && (
                    <div className="flex flex-col items-center gap-2">
                      <button
                        type="button"
                        className="ts-btn px-4 py-2 text-[13px]"
                        onClick={() => void runHdMaterialGeneration()}
                        disabled={
                          hdMatting === "pending" ||
                          status === "loading" ||
                          spriteCacheOnly
                        }
                        title={
                          spriteCacheOnly
                            ? "演示模式未请求接口；取消勾选「仅使用已缓存」后可补全"
                            : undefined
                        }
                      >
                        {hdMatting === "pending"
                          ? "正在请求有机贴图…"
                          : missingAiTileCount > 0
                            ? `补全有机材质 AI 贴图 (剩余 ${missingAiTileCount} 张未缓存)`
                            : "刷新有机贴图缓存"}
                      </button>
                      <p className="max-w-lg text-center text-[11px] text-ink-muted">
                        需配置 GEMINI_API_KEY。已缓存的 (字母 + 材质) 不重复请求。单字与有机贴图共享每日
                        {GEMINI_IMAGE_DAILY_LIMIT} 次图像额度（本机计数）。
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <AiLetterStrip
                    ref={aiLetterStripRef}
                    text={threeBaseText}
                    materialIdsPerChar={materialIdsPerChar}
                    active={
                      asciiPreviewMode === "aiSprites" &&
                      result.source === "three" &&
                      status !== "loading"
                    }
                    spriteCacheOnly={spriteCacheOnly}
                    onGeminiQuotaConsumed={bumpGeminiQuotaUi}
                    onSpriteStored={refreshStoredSpriteCount}
                  />
                  <input
                    ref={aiSpriteImportRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(e) => void handleImportAiSpritesFile(e)}
                  />
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      className="ts-btn px-3 py-1.5 text-[12px]"
                      onClick={() => aiLetterStripRef.current?.refetchMissing()}
                      disabled={
                        status === "loading" ||
                        spriteCacheOnly ||
                        geminiImageDailyExhausted
                      }
                      title={
                        spriteCacheOnly
                          ? "演示模式：不请求网络"
                          : geminiImageDailyExhausted
                            ? "今日额度已用尽"
                            : undefined
                      }
                    >
                      重新拉取缺失单字
                    </button>
                    <button
                      type="button"
                      className="ts-btn px-3 py-1.5 text-[12px]"
                      onClick={handleExportAiSprites}
                    >
                      导出全部单字缓存 (JSON)
                    </button>
                    <button
                      type="button"
                      className="ts-btn px-3 py-1.5 text-[12px]"
                      onClick={handlePickImportAiSprites}
                    >
                      从 JSON 导入
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              className="ts-preview-draggable w-full will-change-transform"
              style={{
                transform: `translate(${previewOffset.x}px, ${previewOffset.y}px)`,
              }}
              onPointerDown={onPreviewPointerDown}
              onPointerMove={onPreviewPointerMove}
              onPointerUp={onPreviewPointerUp}
              onPointerCancel={onPreviewPointerUp}
              onDoubleClick={resetPreviewPosition}
              title="拖动平移 · 双击还原位置"
            >
              {result?.svg ? (
                <div
                  className={`ts-preview-svg ${status === "loading" ? "ts-pulse" : ""}`}
                  aria-label={displayText}
                  role="img"
                  dangerouslySetInnerHTML={{
                    __html: result.svg.replace(/<\?xml[^?]*\?>\s*/, ""),
                  }}
                />
              ) : result?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={result.imageUrl}
                  alt={displayText}
                  draggable={false}
                  className={[
                    "letter-img",
                    status === "loading" ? "ts-pulse" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              ) : (
                <div className="select-none text-center text-[clamp(64px,12vw,168px)] font-black tracking-tight">
                  {displayText}
                </div>
              )}
            </div>
          )}

          {threeCompositorHint}

          {status === "loading" && (
            <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-4">
              <div className="ts-pulse rounded-full bg-white/80 px-3 py-1 text-xs text-ink-muted shadow-soft">
                正在生成…
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Control bar */}
      <section className="mx-auto w-full max-w-[960px] px-6 pb-8">
        {/* Secondary actions row */}
        <div className="mb-4 flex items-center justify-center gap-3">
          <button
            type="button"
            className="ts-btn-icon"
            onClick={handleShuffle}
            title="随机材质重新生成"
            aria-label="随机材质重新生成"
            disabled={status === "loading"}
          >
            <ShuffleIcon />
          </button>
          <button
            type="button"
            className="ts-btn-icon"
            onClick={handleDownload}
            title="下载图片"
            aria-label="下载图片"
            disabled={!result}
          >
            <DownloadIcon />
          </button>
          <button
            type="button"
            className="ts-btn-icon"
            onClick={handleCopyPrompt}
            title="复制 Prompt"
            aria-label="复制 Prompt"
            disabled={!result}
          >
            <CopyIcon />
          </button>
          <button
            type="button"
            className="ts-btn-icon"
            onClick={handleCopyImage}
            title={
              copyRenderState === "rendering"
                ? "渲染中…"
                : copyRenderState === "ready"
                  ? "已渲染完成，可复制最新"
                  : "复制图片到剪贴板 (PNG)"
            }
            aria-label="复制图片到剪贴板"
            disabled={
              copyRenderState === "rendering" ||
              !result ||
              (result.source !== "three" && !result.imageUrl)
            }
          >
            <CopyImageIcon />
          </button>
        </div>
        {(result?.source === "three" && asciiPreviewMode === "aiSprites") ||
        copyRenderState !== "idle" ? (
          <p className="mb-4 text-center text-[11px] text-ink-muted">
            {copyRenderState === "rendering"
              ? "复制图渲染中…"
              : copyRenderState === "ready"
                ? "已将最新变换渲染完成，可继续复制最新图"
                : "复制将使用当前单字拼贴的最新位姿（拖拽/旋转/缩放）"}
          </p>
        ) : null}

        {/* Inputs */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="ts-label" htmlFor="text-input">
              输入文字
            </label>
            <input
              id="text-input"
              className="ts-field mt-2"
              value={text}
              maxLength={60}
              placeholder="Sample"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") generate();
              }}
            />
            {glyphHint && (
              <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
                {glyphHint}
              </p>
            )}
          </div>

          <div>
            <div className="ts-label">材质模式</div>
            <div className="mt-2">
              <TextureSelect
                value={texture}
                onChange={(id) => setTexture(id)}
                disabled={status === "loading"}
              />
            </div>
            {texture === "mixed" && (
              <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
                <strong className="font-medium text-ink">混合材质</strong>在 ASCII 文案下由
                <strong className="font-medium text-ink"> Three 逐字不同 PBR</strong>
                组合呈现;其中苔藓/绒毛/毛毡等有机档可点上方
                <strong className="font-medium text-ink">补全 AI 贴图</strong>
                (按字 + 材质永久缓存)。纯非 ASCII 时回退为本地 SVG。
              </p>
            )}
          </div>
        </div>

        {/* Generate */}
        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            type="button"
            className="ts-btn px-6"
            onClick={() => generate()}
            disabled={status === "loading"}
          >
            <SparklesIcon />
            <span>{status === "loading" ? "Generating…" : "Generate"}</span>
          </button>
          {errorMsg && (
            <div className="max-w-md text-center text-[12px] text-amber-700">
              {errorMsg}
            </div>
          )}
        </div>
      </section>

      {/* Toast */}
      <div className="ts-toast" data-visible={toast ? "true" : "false"}>
        {toast ?? ""}
      </div>
    </main>
  );
}

/** Normalize any fetched image (incl. SVG data URL) to PNG for Clipboard API. */
async function rasterizeToPngBlob(imageUrl: string): Promise<Blob> {
  const res = await fetch(imageUrl);
  const blob = await res.blob();
  if (blob.type === "image/png") return blob;
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bmp.close();
    throw new Error("no 2d context");
  }
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob"))),
      "image/png",
    );
  });
}

/**
 * Client-side mock fallback when the network request fails; uses the same
 * per-glyph renderer as the server + single-letter session fragment cache.
 */
async function fetchMockClient(
  payload: {
    text: string;
    texture: TextureId;
    layout: "stacked" | "inline";
  },
  hooks: ReturnType<typeof createSessionGlyphCacheHooks>,
): Promise<GenerateResponse> {
  const resolvedText = (payload.text || "Sample").trim() || "Sample";
  if (hasPrintableAsciiGlyphs(resolvedText, 60)) {
    if (payload.texture === "spriteCache") {
      const built = buildPrompt({
        text: payload.text,
        texture: payload.texture,
        layout: payload.layout,
      });
      return {
        ok: true,
        source: "three",
        reason: "client_fallback",
        prompt: built.prompt,
        texture: "spriteCache",
        perChar: undefined,
        resolvedText,
      };
    }
    const built = buildPrompt({
      text: payload.text,
      texture: payload.texture,
      layout: payload.layout,
    });
    return {
      ok: true,
      source: "three",
      reason: "client_fallback",
      prompt: built.prompt,
      texture: built.primary.id,
      perChar: built.perChar?.map((t) => t.id),
      resolvedText,
    };
  }
  const { scene, svg } = buildMockOutput({
    text: payload.text,
    texture: payload.texture,
    layout: payload.layout,
    ...toMockFragmentOptions(hooks),
  });
  return {
    ok: true,
    source: "mock",
    reason: "client_fallback",
    prompt: `[Client fallback] "${resolvedText}"`,
    texture: payload.texture,
    resolvedText,
    mimeType: "image/svg+xml",
    imageUrl: svgToDataUrlClient(svg),
    svg,
    mockScene: scene,
  };
}
