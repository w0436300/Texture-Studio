"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MockInteractiveScene } from "@/lib/mock";

interface Props {
  scene: MockInteractiveScene;
  /** When true, the whole SVG gently pulses (e.g. while generating). */
  pulse?: boolean;
  className?: string;
}

type DragMode = "move" | "rotate";

const ROTATE_PIXELS_TO_DEG = 0.45;

/**
 * Local mock preview: each glyph is its own `<g>` so the user can drag letters
 * (normal drag) and rotate (Shift+drag). Gemini raster path cannot do this
 * without segmentation.
 */
export function MockInteractivePreview({
  scene,
  pulse = false,
  className = "",
}: Props) {
  const [offsets, setOffsets] = useState(() =>
    scene.glyphs.map(() => ({ x: 0, y: 0 })),
  );
  const [rotDeg, setRotDeg] = useState(() => scene.glyphs.map(() => 0));
  const offsetsRef = useRef(offsets);
  const rotRef = useRef(rotDeg);
  offsetsRef.current = offsets;
  rotRef.current = rotDeg;

  useEffect(() => {
    setOffsets(scene.glyphs.map(() => ({ x: 0, y: 0 })));
    setRotDeg(scene.glyphs.map(() => 0));
  }, [scene]);

  const dragRef = useRef<{
    index: number;
    mode: DragMode;
    pointerId: number;
    startX: number;
    startY: number;
    ox: number;
    oy: number;
    or: number;
  } | null>(null);

  const onGlyphPointerDown = useCallback(
    (index: number) => (e: React.PointerEvent<SVGGElement>) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      const o = offsetsRef.current[index]!;
      const r = rotRef.current[index]!;
      const mode: DragMode = e.shiftKey ? "rotate" : "move";
      dragRef.current = {
        index,
        mode,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        ox: o.x,
        oy: o.y,
        or: r,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [],
  );

  const onGlyphPointerMove = useCallback((e: React.PointerEvent<SVGGElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (d.mode === "move") {
      setOffsets((prev) => {
        const next = prev.slice();
        next[d.index] = {
          x: d.ox + (e.clientX - d.startX),
          y: d.oy + (e.clientY - d.startY),
        };
        return next;
      });
    } else {
      setRotDeg((prev) => {
        const next = prev.slice();
        next[d.index] =
          d.or + (e.clientX - d.startX) * ROTATE_PIXELS_TO_DEG;
        return next;
      });
    }
  }, []);

  const onGlyphPointerUp = useCallback((e: React.PointerEvent<SVGGElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${scene.viewWidth} ${scene.viewHeight}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={scene.label}
      className={`select-none ${pulse ? "ts-pulse" : ""} ${className}`}
      onDoubleClick={() => {
        setOffsets(scene.glyphs.map(() => ({ x: 0, y: 0 })));
        setRotDeg(scene.glyphs.map(() => 0));
      }}
    >
      <title>拖动平移；按住 Shift 拖动旋转 · 双击整图还原</title>
      <defs dangerouslySetInnerHTML={{ __html: scene.defs }} />
      {scene.glyphs.map((g, i) => {
        const o = offsets[i]!;
        const r = rotDeg[i] ?? 0;
        const ax = 0;
        const ay = g.rotateAnchorY ?? -40;
        return (
          <g
            key={`glyph-${g.index}-${i}`}
            transform={`translate(${g.layoutX + o.x},${g.layoutY + o.y}) rotate(${r}, ${ax}, ${ay})`}
            className="ts-mock-glyph"
            onPointerDown={onGlyphPointerDown(i)}
            onPointerMove={onGlyphPointerMove}
            onPointerUp={onGlyphPointerUp}
            onPointerCancel={onGlyphPointerUp}
          >
            <g dangerouslySetInnerHTML={{ __html: g.fragment }} />
          </g>
        );
      })}
    </svg>
  );
}
