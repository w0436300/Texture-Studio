import * as THREE from "three";
import {
  getCeramicMicroRoughnessMap,
  getJellyBubbleBumpMap,
  getMarbleVeinRoughnessMap,
} from "./three-procedural-textures";
import type { TextureId } from "./textures";

export type ThreeMaterialParams = {
  color: number;
  metalness: number;
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  emissive?: number;
  envMapIntensity: number;
  // Physically-based extras (Three.js MeshPhysicalMaterial)
  transmission?: number;
  thickness?: number;
  ior?: number;
  iridescence?: number;
  iridescenceIOR?: number;
  iridescenceThicknessRange?: [number, number];
  sheen?: number;
  sheenColor?: number;
  sheenRoughness?: number;
};

const DEFAULT_PARAMS: ThreeMaterialParams = {
  color: 0xc8ccd4,
  metalness: 0.55,
  roughness: 0.35,
  clearcoat: 0.15,
  clearcoatRoughness: 0.4,
  envMapIntensity: 1.0,
};

const PRESETS: Partial<Record<TextureId, ThreeMaterialParams>> = {
  chrome: {
    color: 0xe8eef8,
    metalness: 1.0,
    roughness: 0.018,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 2.65,
  },
  gold: {
    color: 0xffc040,
    metalness: 0.96,
    roughness: 0.15,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.8,
  },
  copper: {
    color: 0xc87848,
    metalness: 1.0,
    roughness: 0.24,
    clearcoat: 0.4,
    clearcoatRoughness: 0.14,
    envMapIntensity: 1.55,
  },
  glass: {
    color: 0xf0f8ff,
    metalness: 0,
    roughness: 0.02,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.8,
    transmission: 0.92,
    thickness: 2.0,
    ior: 1.5,
  },
  ice: {
    color: 0xd8f4ff,
    metalness: 0,
    roughness: 0.045,
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.85,
    transmission: 0.88,
    thickness: 2.4,
    ior: 1.31,
  },
  crystal: {
    color: 0xf4f8ff,
    metalness: 0.05,
    roughness: 0.04,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 2.0,
    transmission: 0.88,
    thickness: 1.8,
    ior: 1.7,
  },
  holographic: {
    color: 0xfff8f0,
    metalness: 0.15,
    roughness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    envMapIntensity: 2.45,
    iridescence: 1.0,
    iridescenceIOR: 1.45,
    iridescenceThicknessRange: [180, 520],
  },
  bubble: {
    color: 0xffffff,
    metalness: 0.08,
    roughness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 2.0,
    transmission: 0.55,
    thickness: 0.3,
    ior: 1.2,
    iridescence: 0.85,
    iridescenceIOR: 1.2,
    iridescenceThicknessRange: [150, 320],
  },
  neon: {
    color: 0xff4fd8,
    metalness: 0.15,
    roughness: 0.45,
    clearcoat: 0.2,
    clearcoatRoughness: 0.5,
    emissive: 0x661044,
    envMapIntensity: 0.6,
  },
  moss: {
    color: 0x4a7a52,
    metalness: 0.02,
    roughness: 0.92,
    clearcoat: 0,
    clearcoatRoughness: 0.5,
    envMapIntensity: 0.4,
  },
  wood: {
    color: 0x8b6544,
    metalness: 0,
    roughness: 0.75,
    clearcoat: 0.15,
    clearcoatRoughness: 0.5,
    envMapIntensity: 0.55,
  },
  marble: {
    color: 0xf2f0ee,
    metalness: 0.0,
    roughness: 0.22,
    clearcoat: 0.88,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.35,
  },
  clay: {
    color: 0xd4937a,
    metalness: 0,
    roughness: 0.84,
    clearcoat: 0.06,
    clearcoatRoughness: 0.5,
    envMapIntensity: 0.5,
  },
  ceramic: {
    color: 0xa8c8e8,
    metalness: 0.0,
    roughness: 0.34,
    clearcoat: 0.92,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.45,
  },
  chocolate: {
    color: 0x3a2418,
    metalness: 0.04,
    roughness: 0.5,
    clearcoat: 0.5,
    clearcoatRoughness: 0.24,
    envMapIntensity: 0.52,
    sheen: 0.5,
    sheenColor: 0x5c4030,
    sheenRoughness: 0.68,
  },
  plush: {
    color: 0xdfc8a8,
    metalness: 0,
    roughness: 0.9,
    clearcoat: 0,
    clearcoatRoughness: 0.5,
    envMapIntensity: 0.4,
    sheen: 1.0,
    sheenColor: 0xfff5e0,
    sheenRoughness: 0.75,
  },
  felt: {
    color: 0x8a7060,
    metalness: 0,
    roughness: 0.95,
    clearcoat: 0,
    clearcoatRoughness: 0.5,
    envMapIntensity: 0.3,
    sheen: 0.85,
    sheenColor: 0xd4a882,
    sheenRoughness: 0.8,
  },
  feltChrome: {
    color: 0x8a7060,
    metalness: 0,
    roughness: 0.95,
    clearcoat: 0,
    clearcoatRoughness: 0.5,
    envMapIntensity: 0.3,
    sheen: 0.85,
    sheenColor: 0xd4a882,
    sheenRoughness: 0.8,
  },
  knit: {
    color: 0xb09078,
    metalness: 0,
    roughness: 0.91,
    clearcoat: 0,
    clearcoatRoughness: 0.5,
    envMapIntensity: 0.36,
    sheen: 0.95,
    sheenColor: 0xeee0d4,
    sheenRoughness: 0.76,
  },
  paper: {
    color: 0xf5f2e8,
    metalness: 0,
    roughness: 0.9,
    clearcoat: 0.02,
    clearcoatRoughness: 0.7,
    envMapIntensity: 0.35,
  },
  latex: {
    color: 0x1a1a1e,
    metalness: 0.35,
    roughness: 0.38,
    clearcoat: 0.8,
    clearcoatRoughness: 0.18,
    envMapIntensity: 0.9,
  },
  jelly: {
    color: 0xf07898,
    metalness: 0.0,
    roughness: 0.06,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.35,
    transmission: 0.72,
    thickness: 1.65,
    ior: 1.42,
  },
  wax: {
    color: 0xfff6e8,
    metalness: 0.0,
    roughness: 0.22,
    clearcoat: 0.95,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.05,
    transmission: 0.38,
    thickness: 2.4,
    ior: 1.46,
  },
  stone: {
    color: 0x8a8a8c,
    metalness: 0.06,
    roughness: 0.82,
    clearcoat: 0.05,
    clearcoatRoughness: 0.6,
    envMapIntensity: 0.4,
  },
  rubber: {
    color: 0x2a2a2e,
    metalness: 0.08,
    roughness: 0.72,
    clearcoat: 0.3,
    clearcoatRoughness: 0.4,
    envMapIntensity: 0.5,
  },
};

export function getThreeMaterialParams(id: TextureId): ThreeMaterialParams {
  return PRESETS[id] ?? DEFAULT_PARAMS;
}

export function createPhysicalMaterialForTexture(
  id: TextureId,
): THREE.MeshPhysicalMaterial {
  const p = getThreeMaterialParams(id);
  const mat = new THREE.MeshPhysicalMaterial({
    color: p.color,
    metalness: p.metalness,
    roughness: p.roughness,
    clearcoat: p.clearcoat,
    clearcoatRoughness: p.clearcoatRoughness,
    emissive: p.emissive ?? 0x000000,
    emissiveIntensity: p.emissive ? 0.35 : 0,
    envMapIntensity: p.envMapIntensity,
  });
  if (p.transmission !== undefined) {
    mat.transmission = p.transmission;
    mat.transparent = true;
  }
  if (p.thickness !== undefined) mat.thickness = p.thickness;
  if (p.ior !== undefined) mat.ior = p.ior;
  if (p.iridescence !== undefined) mat.iridescence = p.iridescence;
  if (p.iridescenceIOR !== undefined) mat.iridescenceIOR = p.iridescenceIOR;
  if (p.iridescenceThicknessRange !== undefined) {
    mat.iridescenceThicknessRange = p.iridescenceThicknessRange;
  }
  if (p.sheen !== undefined) mat.sheen = p.sheen;
  if (p.sheenColor !== undefined) mat.sheenColor = new THREE.Color(p.sheenColor);
  if (p.sheenRoughness !== undefined) mat.sheenRoughness = p.sheenRoughness;

  if (id === "ceramic") {
    mat.roughnessMap = getCeramicMicroRoughnessMap();
  }
  if (id === "marble") {
    mat.roughnessMap = getMarbleVeinRoughnessMap();
  }
  if (id === "jelly") {
    mat.bumpMap = getJellyBubbleBumpMap();
    mat.bumpScale = 0.065;
  }
  if (id === "chrome") {
    mat.specularIntensity = 1.2;
  }
  if (id === "copper") {
    mat.specularIntensity = 1.0;
  }
  return mat;
}
