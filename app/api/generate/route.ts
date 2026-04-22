import { NextRequest, NextResponse } from "next/server";
import { hasPrintableAsciiGlyphs } from "@/lib/ascii-glyphs";
import { buildPrompt } from "@/lib/prompt";
import { buildMockOutput, svgToDataUrl } from "@/lib/mock";
import type { TextureId } from "@/lib/textures";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GenerateBody {
  text?: string;
  texture?: TextureId;
  layout?: "stacked" | "inline";
  outputMimeType?: string;
  model?: string;
  /** If true, client forces the mock branch (used for local UX tuning). */
  mock?: boolean;
}

export async function POST(req: NextRequest) {
  let body: GenerateBody = {};
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    // empty body is fine, we'll use defaults
  }

  const text = (body.text ?? "Sample").toString().slice(0, 60);
  const texture = (body.texture ?? "random") as TextureId;
  const layout = body.layout === "inline" ? "inline" : "stacked";

  const built = buildPrompt({ text, texture, layout });
  const resolvedText = (text || "Sample").trim() || "Sample";

  /** Non-ASCII-only copy falls back to SVG mock (no Three font coverage). */
  if (!hasPrintableAsciiGlyphs(resolvedText, 60)) {
    const { scene: mockScene, svg } = buildMockOutput({
      text,
      texture,
      layout,
      seed: built.seed,
      perCharTextureIds: built.perChar?.map((t) => t.id),
    });
    return NextResponse.json({
      ok: true,
      source: "mock",
      reason: "non_ascii_preview",
      prompt: built.prompt,
      texture: built.primary.id,
      perChar: built.perChar?.map((t) => t.id),
      resolvedText,
      mimeType: "image/svg+xml",
      imageUrl: svgToDataUrl(svg),
      svg,
      mockScene,
    });
  }

  /** ASCII: hero is always Three.js per-glyph composition; organic tiles via /api/generateHdMaterial. */
  return NextResponse.json({
    ok: true,
    source: "three",
    prompt: built.prompt,
    texture: built.primary.id,
    perChar: built.perChar?.map((t) => t.id),
    resolvedText,
  });
}

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: "Method not allowed. Use POST /api/generate.",
    },
    { status: 405 },
  );
}
