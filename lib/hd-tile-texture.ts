import * as THREE from "three";
import type { TextureId } from "./textures";

/**
 * Tuning for Gemini albedo tiles on extruded text — anisotropic filtering,
 * mipmaps, and repeat scale per organic material.
 */
export function configureHdAlbedoTile(
  tex: THREE.Texture,
  renderer: THREE.WebGLRenderer,
  textureId: TextureId,
): void {
  const maxA = renderer.capabilities.getMaxAnisotropy();
  tex.anisotropy = maxA;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;

  const repeat =
    textureId === "moss"
      ? 2.45
      : textureId === "plush"
        ? 2.2
        : textureId === "knit"
          ? 1.85
          : textureId === "wood"
            ? 1.5
            : 1.9;
  tex.repeat.set(repeat, repeat);
  tex.offset.set(0, 0);
  tex.needsUpdate = true;
}

/** After assigning `map`, push material toward fabric / organic response. */
export function tuneMaterialForAiAlbedoTile(
  m: THREE.MeshPhysicalMaterial,
  textureId: TextureId,
): void {
  m.metalness = Math.min(m.metalness, 0.04);
  if (textureId === "wood") {
    m.roughness = THREE.MathUtils.clamp(m.roughness * 0.92, 0.38, 0.9);
    m.envMapIntensity = Math.max(m.envMapIntensity, 0.5);
  } else {
    m.roughness = THREE.MathUtils.clamp(m.roughness * 0.82, 0.52, 0.95);
    m.envMapIntensity = Math.max(m.envMapIntensity, 0.42);
  }
  m.clearcoat = Math.max(m.clearcoat, 0.08);
  m.clearcoatRoughness = Math.min(m.clearcoatRoughness, 0.55);
  m.needsUpdate = true;
}
