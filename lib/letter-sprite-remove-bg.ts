/**
 * Client-side matting for AI letter sprites — strips flat / studio backgrounds
 * so compositing uses true alpha (Gemini often leaves grey or soft backdrop).
 */
export async function removeLetterSpriteBackground(
  base64: string,
  mimeType = "image/png",
): Promise<string> {
  if (typeof window === "undefined") return base64;
  const dataUrl = `data:${mimeType};base64,${base64}`;
  try {
    const { removeBackground } = await import("@imgly/background-removal");
    const outBlob = await removeBackground(dataUrl, {
      output: {
        format: "image/png",
        quality: 0.92,
      },
    });
    return await blobToRawBase64(outBlob);
  } catch {
    return base64;
  }
}

async function blobToRawBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => {
      const s = r.result as string;
      const comma = s.indexOf(",");
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(blob);
  });
}
