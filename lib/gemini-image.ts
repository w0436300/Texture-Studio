/**
 * Shared Gemini image generation (used by poster + HD material tile routes).
 * Model id is configurable; product may refer to the image stack as "Nano Banana"
 * in copy — map via GEMINI_HD_MATERIAL_MODEL / GEMINI_IMAGE_MODEL in env.
 */
export async function tryGenerateWithGemini(
  prompt: string,
  model: string,
  apiKey: string,
): Promise<{ mimeType: string; data: string } | null> {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });

  const response: unknown = await ai.models.generateContent({
    model,
    contents: prompt,
  }) as any;

  const candidates: any[] = (response as any)?.candidates ?? [];
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
