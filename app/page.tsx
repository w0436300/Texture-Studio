"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TextureSelect } from "@/components/TextureSelect";
import {
  CopyIcon,
  DownloadIcon,
  ShuffleIcon,
  SparklesIcon,
} from "@/components/Icons";
import { CONCRETE_TEXTURES, TextureId } from "@/lib/textures";

type Status = "idle" | "loading" | "success" | "warning" | "error";

interface GenerateResponse {
  ok: boolean;
  source: "gemini" | "mock";
  reason?: string;
  warning?: string;
  prompt: string;
  texture: TextureId;
  perChar?: TextureId[];
  mimeType: string;
  imageUrl: string;
}

const DEFAULT_TEXT = "MOCK REVIEW";

export default function Page() {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [texture, setTexture] = useState<TextureId>("mixed");
  const [layout] = useState<"stacked" | "inline">("inline");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayText = text.trim() || "Sample";

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }, []);

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
          const mock = await fetchMockClient(payload);
          setResult(mock);
          setStatus("warning");
          setErrorMsg("接口不可用,已展示本地预览 (405)");
          return;
        }
        if (!res.ok) {
          const mock = await fetchMockClient(payload);
          setResult(mock);
          setStatus("warning");
          setErrorMsg(`服务异常,已展示本地预览 (${res.status})`);
          return;
        }
        const data = (await res.json()) as GenerateResponse;
        setResult(data);
        if (data.source === "mock") {
          setStatus("warning");
          setErrorMsg(
            data.reason === "no_api_key"
              ? "未配置 GEMINI_API_KEY,已展示本地预览"
              : data.warning ?? "已展示本地预览",
          );
        } else {
          setStatus("success");
        }
      } catch (err: any) {
        const mock = await fetchMockClient(payload);
        setResult(mock);
        setStatus("warning");
        setErrorMsg("网络错误,已展示本地预览");
      }
    },
    [text, texture, layout],
  );

  // First render: seed the preview so the page is never empty.
  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleShuffle = useCallback(() => {
    const pool = CONCRETE_TEXTURES;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setTexture(pick.id);
    generate({ textureOverride: pick.id });
  }, [generate]);

  const handleDownload = useCallback(() => {
    if (!result?.imageUrl) {
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
  }, [displayText, result, showToast]);

  const handleCopyPrompt = useCallback(async () => {
    if (!result?.prompt) return;
    try {
      await navigator.clipboard.writeText(result.prompt);
      showToast("Prompt 已复制");
    } catch {
      showToast("复制失败,请手动选择");
    }
  }, [result, showToast]);

  const statusChip = useMemo(() => {
    switch (status) {
      case "loading":
        return { label: "生成中…", tone: "bg-ink-surface text-ink-muted" };
      case "success":
        return { label: "AI 生成完成", tone: "bg-ink text-white" };
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
        {result?.source === "gemini" && (
          <span className="rounded-full border border-ink-line bg-white px-3 py-1 text-[11px] text-ink-muted">
            Gemini
          </span>
        )}
      </div>

      {/* Preview canvas */}
      <section className="flex min-h-[68vh] items-center justify-center px-6 pt-24">
        <div className="ts-preview relative h-[62vh] w-full max-w-[1100px]">
          {result?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={result.imageUrl}
              alt={displayText}
              className={status === "loading" ? "ts-pulse" : ""}
            />
          ) : (
            <div className="select-none text-center text-[clamp(64px,12vw,168px)] font-black tracking-tight">
              {displayText}
            </div>
          )}

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
      <section className="mx-auto w-full max-w-[960px] px-6 pb-16">
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
        </div>

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

/**
 * Client-side mock fallback used when the network request itself fails
 * (so we can't even hit the server-side mock renderer).
 * Renders a minimal SVG with the current text.
 */
async function fetchMockClient(payload: {
  text: string;
  texture: TextureId;
  layout: "stacked" | "inline";
}): Promise<GenerateResponse> {
  const text = (payload.text || "Sample").trim() || "Sample";
  const safe = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="100%" height="100%" fill="#fafafa"/>
  <text x="512" y="560" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="140" font-weight="900" fill="#0b0b0c">${safe}</text>
</svg>`;
  const url = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  return {
    ok: true,
    source: "mock",
    reason: "client_fallback",
    prompt: `[Client fallback] "${text}"`,
    texture: payload.texture,
    mimeType: "image/svg+xml",
    imageUrl: url,
  };
}
