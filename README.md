# Texture Studio · 材质字效生成器

基于 Next.js + Three.js + Gemini 的文字材质实验场。当前主流程是 **ASCII 文本走 Three 逐字预览**，并支持 **AI 单字拼贴缓存演示**。

![preview](./assets/preview.svg)

## Features

- **Two ASCII preview modes**
  - `结合预览`：Three 挤出字母 + PBR 材质（可选有机贴图）
  - `AI 单字拼贴`：按 `(字母码点 + 材质 id)` 读取/生成单字 PNG，支持拖拽、旋转、缩放
- **Material rails**
  - **Three PBR（不调图像 API）**：`chrome` / `gold` / `glass` / `ceramic` / `holographic` / `jelly` 等
  - **AI tile（按需补图）**：`moss` / `plush` / `knit` / `wood`
- **Cost control**
  - Gemini 图像调用（单字 sprite + HD tile）共用每日配额：`10` 次（浏览器本地计数）
  - 默认 `仅使用已缓存（演示）`，不调图像接口
  - 达到配额后自动强制仅缓存模式
- **缓存材质模式**
  - 新增 `缓存材质 (spriteCache)`：每个字母可从该码点已有缓存里选任意材质
  - 每次 Generate 会轮换已有材质，不固定一套
- **Sprite persistence**
  - localStorage: `sprite_*`
  - 可导出/导入 JSON
  - 可同步到仓库文件 `public/ai-letter-sprite-fixtures/sprites.json`（便于 git 共享）
- **Background removal**
  - 新生成单字：始终抠底一次
  - 历史缓存：每个 `(码点,材质)` 最多补救抠底一次（`sprite_matted_v1_*` 标记），避免反复重跑导致卡顿

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## Environment Variables

| Name | Required | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | Optional | Gemini key。未配置时无法生成新图，但缓存演示可用。 |
| `GEMINI_IMAGE_MODEL` | Optional | 默认 `gemini-2.5-flash-image` |
| `GEMINI_LETTER_SPRITE_MODEL` | Optional | 单字 sprite 专用模型，未填则回退到 `GEMINI_IMAGE_MODEL` |
| `GEMINI_HD_MATERIAL_MODEL` | Optional | HD tile 专用模型，未填则回退到 `GEMINI_IMAGE_MODEL` |
| `TEXTURE_STUDIO_MOCK` | Optional | `1` 强制 mock（用于调试） |
| `ALLOW_SPRITE_DISK_WRITE` | Optional | `production` 下允许 `POST /api/saveAiSpriteFixtures` 写 `public/ai-letter-sprite-fixtures/sprites.json` |

## API (current)

- `POST /api/generate`
  - ASCII 正常返回 `source: "three"`（用于 Three/拼贴流程）
  - 非 ASCII 返回 `source: "mock"`（SVG）
  - 不再返回 `source: "gemini"` 整图
- `POST /api/generateLetterSprite`
  - 生成单字 PNG（随后客户端抠底并缓存）
- `POST /api/generateHdMaterial`
  - 生成有机材质方形 tile（`moss/plush/knit/wood`）
- `POST /api/saveAiSpriteFixtures`
  - 将单条 sprite 合并写入 `public/ai-letter-sprite-fixtures/sprites.json`（本地开发默认可写）

## Storage Keys

- `sprite_<codePoint>_<textureId>`：单字 PNG（base64）
- `mat_<codePoint>_<textureId>`：HD tile（base64）
- `sprite_matted_v1_<codePoint>_<textureId>`：该 sprite 是否已做过一次抠底补救
- `ts_gemini_img_daily_v1`：每日 Gemini 图像配额计数
- `ts_gemini_cache_only_v1`：仅缓存演示开关

## Project Structure (key files)

- `app/page.tsx`：主 UI、模式切换、额度与导入导出
- `components/AiLetterStrip.tsx`：单字拼贴、缓存加载、一次性抠底补救
- `lib/textures.ts`：材质目录、picker 列表、`spriteCache` 逻辑
- `lib/ai-letter-sprite-cache.ts`：sprite 缓存/fixtures/备份
- `lib/gemini-daily-limit.ts`：每日配额管理
- `app/api/*`：生成与落盘接口
