import { NextRequest, NextResponse } from "next/server";
import { tryGenerateWithGemini } from "@/lib/gemini-image";
import { buildHdMaterialTilePrompt } from "@/lib/hd-material-prompt";
import { isAiTextureMaterial, type TextureId } from "@/lib/textures";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AI texture tile for materials marked `isAiTextureMaterial` (Gemini image).
 * Client caches base64 in localStorage under `mat_{codePoint}_{textureId}`.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "GEMINI_API_KEY not configured" },
      { status: 503 },
    );
  }

  let body: { glyph?: string; textureId?: string };
  try {
    body = (await req.json()) as { glyph?: string; textureId?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const glyphRaw = (body.glyph ?? "").toString().trim();
  const textureId = body.textureId as TextureId;

  const graphemes = Array.from(glyphRaw);
  if (graphemes.length !== 1) {
    return NextResponse.json(
      { ok: false, error: "Exactly one character (glyph) required" },
      { status: 400 },
    );
  }

  if (!isAiTextureMaterial(textureId)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "textureId must be an AI-texture material (organic / micro-detail tier)",
      },
      { status: 400 },
    );
  }

  const glyph = graphemes[0]!;
  const prompt = buildHdMaterialTilePrompt(glyph, textureId);
  const model =
    process.env.GEMINI_HD_MATERIAL_MODEL ??
    process.env.GEMINI_IMAGE_MODEL ??
    "gemini-2.5-flash-image";

  try {
    const img = await tryGenerateWithGemini(prompt, model, apiKey);
    if (!img) {
      return NextResponse.json(
        { ok: false, error: "Model returned no image" },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      mimeType: img.mimeType,
      base64: img.data,
      prompt,
      model,
      glyph,
      textureId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Use POST /api/generateHdMaterial" },
    { status: 405 },
  );
}
