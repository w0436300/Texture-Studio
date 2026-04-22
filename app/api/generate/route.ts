import { NextRequest, NextResponse } from "next/server";
import { buildPrompt } from "@/lib/prompt";
import { renderMockSvg, svgToDataUrl } from "@/lib/mock";
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

/**
 * Call the Gemini image model and return a base64 PNG if available.
 * The SDK surface differs slightly between versions; we access fields
 * defensively so a minor SDK change can't break the route.
 */
async function tryGenerateWithGemini(
  prompt: string,
  model: string,
  apiKey: string,
): Promise<{ mimeType: string; data: string } | null> {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });

  const response: any = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  const candidates: any[] = response?.candidates ?? [];
  for (const cand of candidates) {
    const parts: any[] = cand?.content?.parts ?? [];
    for (const part of parts) {
      const inline = part?.inlineData ?? part?.inline_data;
      if (inline?.data) {
        return {
          mimeType: inline.mimeType ?? inline.mime_type ?? "image/png",
          data: inline.data as string,
        };
      }
    }
  }
  return null;
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
  const requestedModel =
    body.model ?? process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";

  const built = buildPrompt({ text, texture, layout });

  const forceMock =
    body.mock === true || process.env.TEXTURE_STUDIO_MOCK === "1";
  const apiKey = process.env.GEMINI_API_KEY;

  if (!forceMock && apiKey) {
    try {
      const img = await tryGenerateWithGemini(
        built.prompt,
        requestedModel,
        apiKey,
      );
      if (img) {
        return NextResponse.json({
          ok: true,
          source: "gemini",
          model: requestedModel,
          prompt: built.prompt,
          texture: built.primary.id,
          perChar: built.perChar?.map((t) => t.id),
          mimeType: img.mimeType,
          imageUrl: `data:${img.mimeType};base64,${img.data}`,
          base64: img.data,
        });
      }
      // Upstream returned no imagery — fall through to mock.
    } catch (err: any) {
      const message = err?.message ?? "Unknown generation error";
      const svg = renderMockSvg({ text, texture, layout, seed: built.seed });
      return NextResponse.json(
        {
          ok: true,
          source: "mock",
          reason: "gemini_error",
          warning: message,
          prompt: built.prompt,
          texture: built.primary.id,
          perChar: built.perChar?.map((t) => t.id),
          mimeType: "image/svg+xml",
          imageUrl: svgToDataUrl(svg),
          svg,
        },
        { status: 200 },
      );
    }
  }

  // Mock path: either explicitly requested, no API key, or the model
  // returned nothing. We still return 200 so the UI stays healthy.
  const svg = renderMockSvg({ text, texture, layout, seed: built.seed });
  return NextResponse.json({
    ok: true,
    source: "mock",
    reason: forceMock ? "mock_forced" : apiKey ? "no_image_returned" : "no_api_key",
    prompt: built.prompt,
    texture: built.primary.id,
    perChar: built.perChar?.map((t) => t.id),
    mimeType: "image/svg+xml",
    imageUrl: svgToDataUrl(svg),
    svg,
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
