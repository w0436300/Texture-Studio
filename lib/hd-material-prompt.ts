import type { TextureId } from "./textures";
import { isAiTextureMaterial } from "./textures";

const TILE = [
  "Square 1:1 texture tile, seamless edges, no letterform silhouette, no typography",
  "Ultra sharp 8k macro photograph, studio soft light, subtle micro-contrast",
  "Designed to tile on a 3D extruded letter UV — fill frame edge-to-edge",
  "Opaque tile is fine",
  "No watermark, no text, no logo, no frame",
].join(". ");

function subjectFor(textureId: TextureId): string {
  switch (textureId) {
    case "moss":
      return `Hyper-realistic **living moss** carpet: damp velvet micro-leaves, deep emerald to olive variation, tiny water droplets, soft subsurface translucency, organic clumps and fine root hairs, museum macro photography`;
    case "plush":
      return `Hyper-realistic **dense plush / faux fur** pile: directional nap, soft subsurface scattering, individual fiber tufts catching rim light, premium teddy or microfleece, catalog macro shot`;
    case "felt":
      return `Hyper-realistic **pressed wool felt**: dense matted fibers, subtle directional nap, warm craft-studio macro, soft shadows between fiber clumps`;
    case "wood":
      return `Hyper-realistic **natural oak / hardwood** flat-sawn face: clear annual rings, medullary rays, matte varnish, warm brown tones, furniture-grade macro`;
    case "marble":
      return `Hyper-realistic **polished marble** surface: elegant grey veining on light stone, glossy specular, subtle subsurface, architectural sample macro`;
    case "wax":
      return `Hyper-realistic **soft candle wax** surface: gentle translucency, micro ripples, warm cream tones, soft studio grazing light, macro food-styling quality`;
    default:
      return `Hyper-realistic **organic material** surface with rich micro-detail and believable subsurface response`;
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
    `[Tile] ${TILE}.`,
    `[Note] Surface detail tile for the single character "${glyph}" in a 3D typography app — keep material readable at small scale when tiled on extruded letterforms.`,
  ].join("\n");
}
