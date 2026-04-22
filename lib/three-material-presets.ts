import * as THREE from "three";
import type { TextureId } from "./textures";

export type ThreeMaterialParams = {
  color: number;
  metalness: number;
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  emissive?: number;
  envMapIntensity: number;
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
    color: 0xb8c4d8,
    metalness: 0.98,
    roughness: 0.12,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.35,
  },
  gold: {
    color: 0xd4a84b,
    metalness: 0.92,
    roughness: 0.22,
    clearcoat: 0.45,
    clearcoatRoughness: 0.25,
    envMapIntensity: 1.15,
  },
  glass: {
    color: 0xa8d8f0,
    metalness: 0.05,
    roughness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.2,
  },
  crystal: {
    color: 0xe8f4ff,
    metalness: 0.12,
    roughness: 0.06,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.4,
  },
  holographic: {
    color: 0xc9b2ff,
    metalness: 0.55,
    roughness: 0.18,
    clearcoat: 0.9,
    clearcoatRoughness: 0.15,
    envMapIntensity: 1.5,
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
    envMapIntensity: 0.35,
  },
  wood: {
    color: 0x8b6544,
    metalness: 0,
    roughness: 0.78,
    clearcoat: 0.12,
    clearcoatRoughness: 0.55,
    envMapIntensity: 0.45,
  },
  marble: {
    color: 0xe8e4e8,
    metalness: 0.02,
    roughness: 0.35,
    clearcoat: 0.35,
    clearcoatRoughness: 0.3,
    envMapIntensity: 0.85,
  },
  clay: {
    color: 0xc9987a,
    metalness: 0,
    roughness: 0.88,
    clearcoat: 0.08,
    clearcoatRoughness: 0.6,
    envMapIntensity: 0.4,
  },
  ceramic: {
    color: 0xf2f0ea,
    metalness: 0.08,
    roughness: 0.28,
    clearcoat: 0.55,
    clearcoatRoughness: 0.18,
    envMapIntensity: 0.95,
  },
  plush: {
    color: 0xc4a882,
    metalness: 0,
    roughness: 0.95,
    clearcoat: 0,
    clearcoatRoughness: 0.5,
    envMapIntensity: 0.3,
  },
  felt: {
    color: 0x7a6a58,
    metalness: 0,
    roughness: 0.97,
    clearcoat: 0,
    clearcoatRoughness: 0.5,
    envMapIntensity: 0.28,
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
    roughness: 0.42,
    clearcoat: 0.65,
    clearcoatRoughness: 0.22,
    envMapIntensity: 0.75,
  },
  jelly: {
    color: 0xff9ec4,
    metalness: 0.02,
    roughness: 0.15,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
    envMapIntensity: 0.9,
  },
  wax: {
    color: 0xf0d890,
    metalness: 0.02,
    roughness: 0.55,
    clearcoat: 0.35,
    clearcoatRoughness: 0.35,
    envMapIntensity: 0.55,
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
    roughness: 0.78,
    clearcoat: 0.25,
    clearcoatRoughness: 0.45,
    envMapIntensity: 0.45,
  },
  bubble: {
    color: 0xffb8e8,
    metalness: 0.04,
    roughness: 0.22,
    clearcoat: 0.75,
    clearcoatRoughness: 0.18,
    envMapIntensity: 0.85,
  },
};

export function getThreeMaterialParams(id: TextureId): ThreeMaterialParams {
  return PRESETS[id] ?? DEFAULT_PARAMS;
}

export function createPhysicalMaterialForTexture(
  id: TextureId,
): THREE.MeshPhysicalMaterial {
  const p = getThreeMaterialParams(id);
  return new THREE.MeshPhysicalMaterial({
    color: p.color,
    metalness: p.metalness,
    roughness: p.roughness,
    clearcoat: p.clearcoat,
    clearcoatRoughness: p.clearcoatRoughness,
    emissive: p.emissive ?? 0x000000,
    emissiveIntensity: p.emissive ? 0.35 : 0,
    envMapIntensity: p.envMapIntensity,
  });
}
