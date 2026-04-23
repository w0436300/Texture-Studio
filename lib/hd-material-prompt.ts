import type { TextureId } from "./textures";
import { isAiTextureMaterial } from "./textures";

const TILE = [
  "Output is a **square 1:1** flat material swatch only — **orthographic top-down**, no perspective, no letter shapes, no typography, no watermark",
  "**Basecolor / albedo** intent: even studio lighting, **avoid harsh cast shadows and blown specular hotspots** so it tiles as a neutral color map on 3D UVs",
  "**Seamlessly tileable** on all four edges; continuous micro-detail to the frame border; fill edge-to-edge",
  "Ultra sharp macro, high micro-contrast in surface relief (fibers, blades, grain), **physically plausible color**",
  "Opaque material; no frame, no props, no floor",
].join(". ");

function subjectFor(textureId: TextureId): string {
  switch (textureId) {
    case "moss":
      return `**Dense living moss turf**: thousands of tiny upright **blades and filaments**, deep emerald to yellow-green variation, damp highlights, **3D depth** (not a flat photo of moss paper); micro shadows only as subtle albedo variation, not hard cast shadows`;
    case "plush":
      return `**Deep pile faux fur / microfleece**: directional nap, **individual tufts** visible, soft tonal variation, premium textile catalog macro — must read as **volume**, not a printed flat pattern`;
    case "knit":
      return `**Chunky wool cable-knit**: clear **V-stitches and cable rows**, yarn twist visible, warm neutral grey-beige wool tones, soft pilling — tactile textile macro`;
    case "wood":
      return `**Flat-sawn hardwood face** (oak or walnut): **annual rings and medullary rays** clearly readable, matte satin varnish, warm brown, furniture-grade sample — grain runs in varied directions across tile for natural tiling`;
    default:
      return `**Organic material** surface with rich micro-relief and believable color variation`;
  }
}

export function buildHdMaterialTilePrompt(
  glyph: string,
  textureId: TextureId,
): string {
  if (!isAiTextureMaterial(textureId)) {
    throw new Error(`buildHdMaterialTilePrompt: not an AI-texture material: ${textureId}`);
  }
  const mat = subjectFor(textureId);
  return [
    `[Subject] ${mat}.`,
    `[Tile requirements] ${TILE}.`,
    `[Use] This image will be used as a **repeating diffuse map** on extruded 3D letters (character "${glyph}") — prioritize **tiling quality** and **readability at small repeat** over artistic framing.`,
  ].join("\n");
}
