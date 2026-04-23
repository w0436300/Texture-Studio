import { mkdir, readFile, writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";

const FIXTURE_FILE = path.join(
  process.cwd(),
  "public",
  "ai-letter-sprite-fixtures",
  "sprites.json",
);

function isDiskWriteAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_SPRITE_DISK_WRITE === "1"
  );
}

function assertSpriteKey(key: unknown): key is string {
  return typeof key === "string" && /^sprite_\d+_[a-zA-Z0-9]+$/.test(key);
}

export async function POST(req: Request) {
  if (!isDiskWriteAllowed()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Disk write disabled in production. Use NODE_ENV=development or set ALLOW_SPRITE_DISK_WRITE=1.",
      },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const key = (body as { key?: unknown }).key;
  const base64 = (body as { base64?: unknown }).base64;
  if (!assertSpriteKey(key) || typeof base64 !== "string" || base64.length < 40) {
    return NextResponse.json(
      { ok: false, error: "Expected { key: \"sprite_<cp>_<textureId>\", base64: \"...\" }" },
      { status: 400 },
    );
  }

  const dir = path.dirname(FIXTURE_FILE);
  await mkdir(dir, { recursive: true });

  let entries: Record<string, string> = {};
  try {
    const raw = await readFile(FIXTURE_FILE, "utf8");
    const parsed = JSON.parse(raw) as { entries?: unknown };
    if (parsed.entries && typeof parsed.entries === "object" && !Array.isArray(parsed.entries)) {
      entries = parsed.entries as Record<string, string>;
    }
  } catch {
    /* missing or invalid — start fresh */
  }

  entries[key] = base64;

  const payload = {
    version: 1 as const,
    kind: "texture-studio-ai-sprites",
    exportedAt: new Date().toISOString(),
    entryCount: Object.keys(entries).length,
    entries,
  };

  await writeFile(FIXTURE_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  return NextResponse.json({ ok: true, entryCount: payload.entryCount });
}
