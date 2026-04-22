# Texture Studio · 材质字效生成器

将普通文字一键生成具有 **高级材质 + 堆叠感** 的 3D 视觉海报。
基于 Next.js + Gemini Image Model,内置 SVG Mock 渲染保证无 API 也能预览。

![preview](./assets/preview.svg)

## ✨ Features

- **文字输入**:中英文任意字符串,fallback 默认 `Sample`。
- **材质系统**:内置 20+ 预设材质(Clay / Glass / Plush / Chrome / Moss / Ceramic / Jelly / Latex / Paper / Felt / Marble / Holographic / Wood / Gold / Wax / Stone / Rubber / Crystal / Bubblegum / Neon …)。
  - `随机材质` · 随机挑选
  - `混合材质` · 每个字符使用不同材质
- **Prompt Engine**:`[Style] + [Subject] + [Layout] + [Texture] + [Color] + [Quality]` 结构化 Prompt。
- **Image API**:`POST /api/generate`,优先调用 Gemini,任何异常自动降级到本地 Mock。
- **Mock 模式**:无 API Key 或 API 失败时返回可读的 SVG 预览,保证 UX 不中断。
- **导出**:一键下载、复制 Prompt、随机重生成。
- **错误处理**:200 / 405 / 500 / network error 全部有 fallback,UI 永远不崩。

## 🧱 Tech Stack

- [Next.js 14 (App Router)](https://nextjs.org)
- React 18, TypeScript
- TailwindCSS
- [@google/genai](https://www.npmjs.com/package/@google/genai) for Gemini Image

## 🚀 Quick Start

```bash
# 1. install
npm install

# 2. configure env
cp .env.example .env.local
# edit .env.local and paste your GEMINI_API_KEY

# 3. dev
npm run dev
# -> http://localhost:3000
```

如果不填 `GEMINI_API_KEY`,应用会自动使用本地 SVG 预览,所有功能依然可用。

## 🔧 Environment Variables

| Name | Required | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | optional | Google Gemini API Key。未填写时走本地 mock。 |
| `GEMINI_IMAGE_MODEL` | optional | 默认 `gemini-2.5-flash-image`。 |
| `TEXTURE_STUDIO_MOCK` | optional | 设为 `1` 可强制走 mock(用于本地 UX 调优)。 |

## 🧠 Prompt Structure

```
[Style]   ultra high-end 3D typographic poster, clean minimal composition …
[Subject] the word "MOCK REVIEW" rendered entirely in chrome — mirror finish …
[Layout]  arrange the characters on a single clean inline row, evenly spaced …
[Texture] emphasize authentic material detail, micro surface imperfections …
[Color]   palette harmonized with the material, restrained and editorial.
[Quality] 8k, extremely sharp, octane/cinema4d render feel, editorial poster look.
```

## 🔁 API

### `POST /api/generate`

**Request**

```json
{
  "text": "MOCK REVIEW",
  "texture": "random",
  "layout": "inline"
}
```

**Response**

```json
{
  "ok": true,
  "source": "gemini",            // or "mock"
  "prompt": "[Style] …",
  "texture": "chrome",
  "mimeType": "image/png",
  "imageUrl": "data:image/png;base64,…"
}
```

| 状态 | 行为 |
| --- | --- |
| 200 (gemini) | 正常展示 AI 图像 |
| 200 (mock)   | 以 SVG 预览替代,UI 显示"本地预览"提示 |
| 405 / 500    | 客户端自动降级到 mock 并提示 |
| network err  | 客户端本地 SVG fallback |

## 📁 Project Structure

```
app/
  api/generate/route.ts   # Gemini + mock fallback
  layout.tsx
  page.tsx                # Main UI
  globals.css
components/
  TextureSelect.tsx
  Icons.tsx
lib/
  textures.ts             # 20+ texture catalog
  prompt.ts               # Prompt engine
  mock.ts                 # SVG mock renderer
```

## 🗺 Roadmap

- [ ] Layout: stacked 多行雕塑感排布
- [ ] Batch generate (N 张一起出)
- [ ] 历史记录与收藏
- [ ] 自定义材质 descriptor
