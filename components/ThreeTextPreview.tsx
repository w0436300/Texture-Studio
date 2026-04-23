"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import type { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { GlyphUnit } from "@/lib/ascii-glyphs";
import { asciiGlyphUnits } from "@/lib/ascii-glyphs";
import {
  readHdMaterialBase64,
  toDataUrlFromStored,
} from "@/lib/hd-material-cache";
import { createPhysicalMaterialForTexture } from "@/lib/three-material-presets";
import {
  disposeThreeProceduralTextures,
  isSharedProceduralTexture,
} from "@/lib/three-procedural-textures";
import { isAiTextureMaterial, type TextureId } from "@/lib/textures";

const FONT_URL = "/fonts/helvetiker_bold.typeface.json";

const ROTATE_SENS = 0.012;
const DRAG_SENS = 0.22;
/** Guard ResizeObserver / flex bugs from passing absurd dimensions into WebGL. */
const MAX_PREVIEW_PX = 4096;

export type ThreeTextPreviewHandle = {
  /** PNG data URL from the WebGL canvas (for download / clipboard). */
  toDataURLpng: () => string | null;
};

type Props = {
  text: string;
  materialIdsPerChar: TextureId[];
  /** Bump after new HD tiles land in localStorage so textures reload. */
  hdMatEpoch?: number;
  className?: string;
};

type SavedXform = {
  px: number;
  py: number;
  pz: number;
  rz: number;
  /** Uniform scale (optional for legacy cache entries). */
  sc?: number;
};

function readXformCache(key: string): SavedXform[] | null {
  if (typeof window === "undefined") return null;
  try {
    const s = sessionStorage.getItem(key);
    if (!s) return null;
    const j = JSON.parse(s) as SavedXform[];
    return Array.isArray(j) ? j : null;
  } catch {
    return null;
  }
}

function writeXformCache(key: string, groups: THREE.Group[]): void {
  if (typeof window === "undefined") return;
  try {
    const data: SavedXform[] = groups.map((g) => ({
      px: g.position.x,
      py: g.position.y,
      pz: g.position.z,
      rz: g.rotation.z,
      sc: g.scale.x,
    }));
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* quota */
  }
}

function clearXformCache(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* */
  }
}

export function cacheKeyForThreeLayout(
  units: GlyphUnit[],
  matIds: TextureId[],
): string {
  const sig = units.map((u) => `${u.sourceIndex}:${u.ch}`).join(",");
  const mats = units.map((u) => matIds[u.sourceIndex] ?? "clay").join(",");
  return `ts_three_xform_v2|${sig}|${mats}`;
}

interface PreviewCtx {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  root: THREE.Group;
  letterGroups: THREE.Group[];
  /** Last picked letter; Shift+wheel scales this group. */
  selectedLetter: THREE.Group | null;
  font: Font | null;
  raycaster: THREE.Raycaster;
  ndc: THREE.Vector2;
  drag: null | {
    group: THREE.Group;
    mode: "move" | "rotate";
    pointerId: number;
    lastX: number;
    lastY: number;
  };
}

const LETTER_SCALE_MIN = 0.35;
const LETTER_SCALE_MAX = 3;

export const ThreeTextPreview = forwardRef<
  ThreeTextPreviewHandle,
  Props
>(function ThreeTextPreview(
  { text, materialIdsPerChar, hdMatEpoch = 0, className },
  ref,
) {
  const mountRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<PreviewCtx | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fontReady, setFontReady] = useState(false);

  const debouncedText = useDebounced(text, 200);
  const units = useMemo(
    () => asciiGlyphUnits(debouncedText, 40),
    [debouncedText],
  );
  const xformKey = useMemo(
    () => cacheKeyForThreeLayout(units, materialIdsPerChar),
    [units, materialIdsPerChar],
  );

  const unitsRef = useRef(units);
  const matIdsRef = useRef(materialIdsPerChar);
  const xformKeyRef = useRef(xformKey);
  unitsRef.current = units;
  matIdsRef.current = materialIdsPerChar;
  xformKeyRef.current = xformKey;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    // High-key studio — closer to product / poster references
    scene.background = new THREE.Color(0xffffff);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 2500);
    camera.position.set(0, 10, 500);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.touchAction = "none";
    mount.appendChild(renderer.domElement);

    // Neutral room environment — provides env reflections for metals / glass
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment()).texture;
    scene.environment = envTexture;
    pmrem.dispose();

    // Studio lighting + soft shadows for ground contact (real-time, not path-traced)
    const amb = new THREE.AmbientLight(0xffffff, 0.42);
    scene.add(amb);
    const hemi = new THREE.HemisphereLight(0xffffff, 0xe8eaef, 0.35);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 1.35);
    key.position.set(140, 220, 280);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 50;
    key.shadow.camera.far = 900;
    key.shadow.camera.left = -320;
    key.shadow.camera.right = 320;
    key.shadow.camera.top = 320;
    key.shadow.camera.bottom = -320;
    key.shadow.bias = -0.00025;
    key.shadow.normalBias = 0.035;
    key.shadow.radius = 6;
    scene.add(key);

    const rim = new THREE.DirectionalLight(0xc8dcff, 0.42);
    rim.position.set(-220, 80, -120);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0xfff5f0, 0.32);
    fill.position.set(-80, -40, 220);
    scene.add(fill);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(6000, 6000),
      new THREE.ShadowMaterial({ opacity: 0.2 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -88;
    ground.receiveShadow = true;
    scene.add(ground);

    const root = new THREE.Group();
    scene.add(root);

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    const ctx: PreviewCtx = {
      scene,
      camera,
      renderer,
      root,
      letterGroups: [],
      selectedLetter: null,
      font: null,
      raycaster,
      ndc,
      drag: null,
    };
    ctxRef.current = ctx;

    let raf = 0;
    let cancelled = false;

    const setSize = () => {
      if (cancelled || !mount) return;
      const rawW = mount.clientWidth;
      const rawH = mount.clientHeight;
      const w = Math.floor(
        Math.min(MAX_PREVIEW_PX, Math.max(2, rawW)),
      );
      const h = Math.floor(
        Math.min(MAX_PREVIEW_PX, Math.max(2, rawH)),
      );
      if (!Number.isFinite(w) || !Number.isFinite(h)) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, true);
    };

    setSize();
    const ro = new ResizeObserver(setSize);
    ro.observe(mount);

    const tick = () => {
      if (cancelled) return;
      raf = requestAnimationFrame(tick);
      renderer.render(scene, camera);
    };
    tick();

    const pickGroup = (clientX: number, clientY: number): THREE.Group | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(root.children, true);
      for (const h of hits) {
        let o: THREE.Object3D | null = h.object;
        while (o) {
          if (o.userData?.isLetterRoot === true) return o as THREE.Group;
          o = o.parent;
        }
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const g = pickGroup(e.clientX, e.clientY);
      if (!g) {
        ctx.selectedLetter = null;
        return;
      }
      ctx.selectedLetter = g;
      e.preventDefault();
      renderer.domElement.setPointerCapture(e.pointerId);
      ctx.drag = {
        group: g,
        mode: e.shiftKey ? "rotate" : "move",
        pointerId: e.pointerId,
        lastX: e.clientX,
        lastY: e.clientY,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      const d = ctx.drag;
      if (!d || e.pointerId !== d.pointerId) return;
      const dx = e.clientX - d.lastX;
      const dy = e.clientY - d.lastY;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      if (d.mode === "move") {
        d.group.position.x += dx * DRAG_SENS;
        d.group.position.y -= dy * DRAG_SENS;
      } else {
        d.group.rotation.z += dx * ROTATE_SENS;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const d = ctx.drag;
      if (!d || e.pointerId !== d.pointerId) return;
      ctx.drag = null;
      try {
        renderer.domElement.releasePointerCapture(e.pointerId);
      } catch {
        /* */
      }
      writeXformCache(xformKeyRef.current, ctx.letterGroups);
    };

    const onDblClick = () => {
      clearXformCache(xformKeyRef.current);
      ctx.selectedLetter = null;
      for (const g of ctx.letterGroups) {
        g.position.set(0, 0, 0);
        g.rotation.set(0, 0, 0);
        g.scale.setScalar(1);
      }
      layoutLetterGroups(ctx, unitsRef.current, matIdsRef.current);
      writeXformCache(xformKeyRef.current, ctx.letterGroups);
    };

    const onWheel = (e: WheelEvent) => {
      if (!e.shiftKey) return;
      const sel = ctx.selectedLetter;
      if (
        !sel ||
        !ctx.letterGroups.some((g) => g === sel)
      ) {
        return;
      }
      e.preventDefault();
      const next = THREE.MathUtils.clamp(
        sel.scale.x * Math.exp(-e.deltaY * 0.0018),
        LETTER_SCALE_MIN,
        LETTER_SCALE_MAX,
      );
      sel.scale.setScalar(next);
      writeXformCache(xformKeyRef.current, ctx.letterGroups);
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);
    renderer.domElement.addEventListener("dblclick", onDblClick);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    const loader = new FontLoader();
    void loader
      .loadAsync(FONT_URL)
      .then((font) => {
        if (cancelled) return;
        ctx.font = font;
        setLoadError(null);
        setFontReady(true);
      })
      .catch(() => {
        if (!cancelled) setLoadError("字体加载失败");
      });

    return () => {
      cancelled = true;
      setFontReady(false);
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      renderer.domElement.removeEventListener("dblclick", onDblClick);
      renderer.domElement.removeEventListener("wheel", onWheel);
      disposeLetters(ctx);
      ground.geometry.dispose();
      (ground.material as THREE.Material).dispose();
      scene.remove(ground);
      envTexture.dispose();
      disposeThreeProceduralTextures();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
      ctxRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    toDataURLpng: () => {
      const ctx = ctxRef.current;
      if (!ctx) return null;
      try {
        return ctx.renderer.domElement.toDataURL("image/png");
      } catch {
        return null;
      }
    },
  }));

  useEffect(() => {
    const ctx = ctxRef.current;
    if (!fontReady || !ctx?.font) return;

    disposeLetters(ctx);
    buildLetters(ctx, units, materialIdsPerChar);
    const saved = readXformCache(xformKey);
    if (saved && saved.length === ctx.letterGroups.length) {
      ctx.letterGroups.forEach((g, i) => {
        const s = saved[i];
        if (!s) return;
        g.position.set(s.px, s.py, s.pz);
        g.rotation.set(0, 0, s.rz);
        g.scale.setScalar(s.sc ?? 1);
      });
    } else {
      layoutLetterGroups(ctx, units, materialIdsPerChar);
    }
    void applyHdMapsFromStorage(ctx, units, materialIdsPerChar);
  }, [fontReady, units, materialIdsPerChar, xformKey, hdMatEpoch]);

  return (
    <div
      className={[
        "ts-three-preview relative w-full min-h-0 shrink-0 overflow-hidden rounded-2xl border border-ink-line bg-white",
        "h-[min(52vh,520px)]",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div ref={mountRef} className="absolute inset-0 min-h-0 w-full" />
      {loadError && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/90 text-xs text-black/60">
          {loadError}
        </div>
      )}
      <div className="pointer-events-none absolute bottom-2 left-3 right-3 text-[10px] text-black/30">
        Three.js · 逐字挤出 · 点选字母 · 拖动平移 · Shift+拖动旋转 ·
        Shift+滚轮缩放 · 双击还原 · 布局存 sessionStorage · 材质与左侧选项联动 (ASCII)
      </div>
    </div>
  );
});

function disposeLetters(ctx: PreviewCtx) {
  ctx.selectedLetter = null;
  for (const g of ctx.letterGroups) {
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry?.dispose();
        const m = o.material;
        const disposeOne = (mat: THREE.Material) => {
          if (mat instanceof THREE.MeshStandardMaterial) {
            if (mat.map) {
              mat.map.dispose();
              mat.map = null;
            }
            const detachMap = (tex: THREE.Texture | null | undefined) => {
              if (!tex) return;
              if (!isSharedProceduralTexture(tex)) tex.dispose();
            };
            detachMap(mat.roughnessMap);
            mat.roughnessMap = null;
            detachMap(mat.metalnessMap);
            mat.metalnessMap = null;
            detachMap(mat.normalMap);
            mat.normalMap = null;
            detachMap(mat.bumpMap);
            mat.bumpMap = null;
            detachMap(mat.aoMap);
            mat.aoMap = null;
          }
          mat.dispose();
        };
        if (Array.isArray(m)) m.forEach(disposeOne);
        else if (m) disposeOne(m);
      }
    });
    ctx.root.remove(g);
  }
  ctx.letterGroups = [];
}

async function applyHdMapsFromStorage(
  ctx: PreviewCtx,
  units: GlyphUnit[],
  matIds: TextureId[],
): Promise<void> {
  const loader = new THREE.TextureLoader();
  for (let i = 0; i < ctx.letterGroups.length; i++) {
    const g = ctx.letterGroups[i];
    const mesh = g.children[0];
    if (!(mesh instanceof THREE.Mesh)) continue;
    const u = units[i];
    if (!u) continue;
    const tid = matIds[u.sourceIndex] ?? "clay";
    if (!isAiTextureMaterial(tid)) continue;
    const cp = u.ch.codePointAt(0) ?? 0;
    const stored = readHdMaterialBase64(cp, tid);
    if (!stored) continue;
    const url = toDataUrlFromStored(stored);
    try {
      const tex = await loader.loadAsync(url);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1.2, 1.2);
      const m = mesh.material as THREE.MeshPhysicalMaterial;
      if (m.map) m.map.dispose();
      m.map = tex;
      m.roughness = Math.min(0.95, m.roughness + 0.08);
      m.needsUpdate = true;
    } catch {
      /* ignore bad cache entry */
    }
  }
}

function buildLetters(
  ctx: PreviewCtx,
  units: GlyphUnit[],
  matIds: TextureId[],
) {
  const { font, root } = ctx;
  if (!font) return;

  // Puffier / inflated letter style — larger bevel reads closer to balloon / resin refs
  const size = 52;
  const depth = 24;

  for (const u of units) {
    const matId = matIds[u.sourceIndex] ?? "clay";
    const mat = createPhysicalMaterialForTexture(matId);
    const geo = new TextGeometry(u.ch, {
      font,
      size,
      depth,
      curveSegments: 16,
      bevelEnabled: true,
      bevelThickness: 6,
      bevelSize: 4.5,
      bevelOffset: 0,
      bevelSegments: 8,
    });
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    if (bb) {
      const cx = (bb.max.x + bb.min.x) / 2;
      const cy = (bb.max.y + bb.min.y) / 2;
      const cz = (bb.max.z + bb.min.z) / 2;
      geo.translate(-cx, -cy, -cz);
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const g = new THREE.Group();
    g.userData.isLetterRoot = true;
    g.add(mesh);
    root.add(g);
    ctx.letterGroups.push(g);
  }
  ctx.scene.updateMatrixWorld(true);
}

/**
 * Scatter letters across the canvas — alternating y-stagger, slight z-depth
 * variation, and per-letter rotation to match the inflated 3D sculpture
 * reference aesthetic. Layout is deterministic per (index, codepoint) so
 * double-click always restores the same "home" positions.
 */
function layoutLetterGroups(
  ctx: PreviewCtx,
  units: GlyphUnit[],
  _matIds: TextureId[],
) {
  const { letterGroups, font } = ctx;
  if (!font || letterGroups.length === 0) return;

  const size = 52;
  const gap = 6;

  // Measure each letter's width with a cheap no-bevel geometry
  const widths: number[] = [];
  for (let i = 0; i < letterGroups.length; i++) {
    const u = units[i];
    if (!u) { widths.push(size * 0.6); continue; }
    const tmp = new TextGeometry(u.ch, {
      font, size, depth: 16, curveSegments: 4, bevelEnabled: false,
    });
    tmp.computeBoundingBox();
    widths.push(
      tmp.boundingBox ? tmp.boundingBox.max.x - tmp.boundingBox.min.x : size * 0.6,
    );
    tmp.dispose();
  }

  const totalWidth = widths.reduce((s, w) => s + w + gap, 0) - gap;
  let x = -totalWidth / 2;

  letterGroups.forEach((g, i) => {
    const u = units[i];
    const w = widths[i] ?? size * 0.6;
    const cp = u?.ch.codePointAt(0) ?? 65;

    // Deterministic seed per (position, character) → consistent layout
    const s = (i + 1) * 97 + cp * 31;

    // Alternating base y-offset ±22 units (~42% of letter height) with added variance
    const yBase = (i % 2 === 0 ? 1 : -1) * 22;
    const yNoise = (hash(s + 1) - 0.5) * 14;
    const xNoise = (hash(s + 2) - 0.5) * 8;
    const zNoise = (hash(s + 3) - 0.5) * 20;
    const rotZ = (hash(s + 4) - 0.5) * 0.28; // ±~8°

    g.position.set(x + w / 2 + xNoise, yBase + yNoise, zNoise);
    g.rotation.set(0, 0, rotZ);

    x += w + gap;
  });
}

/** Deterministic float in [0, 1) for the given integer seed. */
function hash(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
