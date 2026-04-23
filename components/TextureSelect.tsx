"use client";

import { useEffect, useRef, useState } from "react";
import { getTexture, TEXTURES_FOR_UI, Texture, TextureId } from "@/lib/textures";

interface Props {
  value: TextureId;
  onChange: (id: TextureId) => void;
  disabled?: boolean;
}

export function TextureSelect({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected: Texture = getTexture(value);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="ts-field justify-between"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate text-left">
          {selected.id === "random" ||
          selected.id === "mixed" ||
          selected.id === "spriteCache" ? (
            selected.zh
          ) : (
            <>
              <span>{selected.zh}</span>
              <span className="ml-2 text-ink-muted">{selected.en}</span>
            </>
          )}
        </span>
        <ChevronDown className={open ? "rotate-180" : ""} />
      </button>

      {open && (
        <ul className="ts-dropdown" role="listbox">
          {TEXTURES_FOR_UI.map((t) => (
            <li
              key={t.id}
              role="option"
              aria-selected={t.id === value}
              data-selected={t.id === value}
              className="ts-dropdown-item"
              onClick={() => {
                onChange(t.id);
                setOpen(false);
              }}
            >
              <span className="flex items-center gap-2">
                <Check className="check" />
                <span>{t.zh}</span>
                {t.id !== "random" &&
                  t.id !== "mixed" &&
                  t.id !== "spriteCache" && (
                  <span className="text-ink-muted">{t.en}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChevronDown({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`h-4 w-4 transition-transform ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function Check({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
