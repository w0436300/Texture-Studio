import * as THREE from "three";

const shared = new WeakSet<THREE.Texture>();

function markShared(t: THREE.Texture) {
  shared.add(t);
}

export function isSharedProceduralTexture(t: THREE.Texture): boolean {
  return shared.has(t);
}

let microRoughness: THREE.CanvasTexture | null = null;
let jellyBump: THREE.CanvasTexture | null = null;
let marbleVein: THREE.CanvasTexture | null = null;

/**
 * Shared grayscale roughness + faint crack lines — reads less “flat plastic” on glaze.
 */
export function getCeramicMicroRoughnessMap(): THREE.CanvasTexture {
  if (microRoughness) return microRoughness;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    microRoughness = new THREE.CanvasTexture(canvas);
    markShared(microRoughness);
    return microRoughness;
  }
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 165 + Math.floor(Math.random() * 55);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = "rgba(55,55,70,0.22)";
  ctx.lineWidth = 1;
  for (let k = 0; k < 28; k++) {
    ctx.beginPath();
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      x += (Math.random() - 0.5) * 40;
      y += (Math.random() - 0.5) * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  microRoughness = new THREE.CanvasTexture(canvas);
  microRoughness.wrapS = microRoughness.wrapT = THREE.RepeatWrapping;
  microRoughness.repeat.set(2.8, 2.8);
  microRoughness.colorSpace = THREE.NoColorSpace;
  microRoughness.needsUpdate = true;
  markShared(microRoughness);
  return microRoughness;
}

/**
 * Soft “embedded bubble” bump for translucent jelly / resin.
 */
export function getJellyBubbleBumpMap(): THREE.CanvasTexture {
  if (jellyBump) return jellyBump;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    jellyBump = new THREE.CanvasTexture(canvas);
    markShared(jellyBump);
    return jellyBump;
  }
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 140; i++) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const r = 1.5 + Math.random() * 10;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, "#c8c8c8");
    g.addColorStop(0.55, "#909090");
    g.addColorStop(1, "#808080");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  jellyBump = new THREE.CanvasTexture(canvas);
  jellyBump.wrapS = jellyBump.wrapT = THREE.RepeatWrapping;
  jellyBump.repeat.set(2.2, 2.2);
  jellyBump.colorSpace = THREE.NoColorSpace;
  jellyBump.needsUpdate = true;
  markShared(jellyBump);
  return jellyBump;
}

/** Vein-like roughness variation for polished marble (PBR, no HD tile). */
export function getMarbleVeinRoughnessMap(): THREE.CanvasTexture {
  if (marbleVein) return marbleVein;
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    marbleVein = new THREE.CanvasTexture(canvas);
    markShared(marbleVein);
    return marbleVein;
  }
  ctx.fillStyle = "#c8c8c8";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(55,55,62,0.35)";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 18; i++) {
    ctx.beginPath();
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.moveTo(x, y);
    const segs = 8 + Math.floor(Math.random() * 10);
    for (let s = 0; s < segs; s++) {
      x += (Math.random() - 0.5) * 70;
      y += (Math.random() - 0.5) * 70;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(200,200,208,0.12)";
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.moveTo(0, Math.random() * size);
    ctx.bezierCurveTo(
      size * 0.33,
      Math.random() * size,
      size * 0.66,
      Math.random() * size,
      size,
      Math.random() * size,
    );
    ctx.stroke();
  }
  marbleVein = new THREE.CanvasTexture(canvas);
  marbleVein.wrapS = marbleVein.wrapT = THREE.RepeatWrapping;
  marbleVein.repeat.set(1.6, 1.6);
  marbleVein.colorSpace = THREE.NoColorSpace;
  marbleVein.needsUpdate = true;
  markShared(marbleVein);
  return marbleVein;
}

export function disposeThreeProceduralTextures(): void {
  microRoughness?.dispose();
  jellyBump?.dispose();
  marbleVein?.dispose();
  microRoughness = null;
  jellyBump = null;
  marbleVein = null;
}
