import type { TextureId } from "./textures";

/**
 * One full letter render (not a tiling albedo) — transparent PNG for compositing.
 */
export function buildLetterSpritePrompt(
  glyph: string,
  textureId: TextureId,
  materialDescriptor: string,
): string {
  return [
    `Create **one single** isolated 3D typographic character: the letter **"${glyph}"** only (no other letters, no words).`,
    `**Material / look** (match closely): ${materialDescriptor}`,
    `**Background — critical**: the entire canvas outside the letter must be **100% transparent alpha (RGBA A=0)**. **No** white, grey, cream, gradient, vignette, paper, floor, wall, shadow card, or “checkerboard preview” pixels behind the glyph. Only the letter occupies opaque pixels.`,
    `**Output file**: PNG with **straight alpha**; premultiplied alpha acceptable only if edges stay clean.`,
    `**Lighting**: studio key + fill on the letter only; any soft ground contact must fade to **transparent**, never to solid #808080 or #ffffff fill.`,
    `**Composition**: letter centered, large in frame (~75–90% of image height), sculptural inflated/beveled 3D extrusion style.`,
    `Photoreal, high detail, editorial 3D typography quality.`,
    `[Technical] textureId=${textureId} — for metadata only; do not render this text on the image.`,
  ].join("\n");
}
