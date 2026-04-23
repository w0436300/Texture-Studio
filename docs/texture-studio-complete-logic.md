# Texture Studio · 完整逻辑说明（当前实现）

> 本文档描述仓库当前真实逻辑（以代码为准），用于对齐产品、开发、测试。

---

## 1. 主流程概览

### 1.1 `POST /api/generate` 的输出

- ASCII 文本：返回 `source: "three"`（前端走 Three 逐字预览）
- 非 ASCII 文本：返回 `source: "mock"`（SVG 预览）
- 当前 `generate` 不返回 `source: "gemini"` 整图

### 1.2 两种 ASCII 预览模式

- `结合预览`
  - Three 挤出字母预览
  - 每字可独立位姿（拖拽、旋转、缩放）
  - 需要时补有机材质 HD tile
- `AI 单字拼贴`
  - 每个字母读取/生成单字 PNG（`sprite_*`）
  - 逐字拖拽/旋转/缩放
  - 支持导出/导入 JSON

---

## 2. 材质体系

### 2.1 picker（当前 UI）

- `random`
- `mixed`
- `spriteCache`（缓存材质）
- `chrome`, `gold`, `glass`, `ceramic`, `holographic`, `moss`, `wood`, `jelly`

### 2.2 材质轨道

- Three PBR 轨：除 AI 有机材质外的其余 concrete id
- AI tile 轨（`isAiTextureMaterial`）：`moss`, `plush`, `knit`, `wood`

### 2.3 `spriteCache` 规则

- 含义：对每个字母码点，从已有缓存中选择“任意可用材质”的单字图
- 选择来源：`localStorage` + 已预取 `public/ai-letter-sprite-fixtures/sprites.json`
- 每次成功 Generate（且材质为 `spriteCache`）会递增 shuffle key
- 若同一码点有多种缓存材质，会轮换显示，不固定

---

## 3. 成本控制与 demo 模式

### 3.1 每日额度

- Gemini 图像调用统一池：`GEMINI_IMAGE_DAILY_LIMIT = 10`
- 计数 key：`ts_gemini_img_daily_v1`
- 计数时机：图像请求成功后才 `recordGeminiImageSuccess()`
- 计入范围：
  - `/api/generateLetterSprite`
  - `/api/generateHdMaterial`

### 3.2 演示模式（仅缓存）

- 开关 key：`ts_gemini_cache_only_v1`
- 默认开启（不调图像接口）
- 到达每日上限后自动强制开启且不可关闭
- 仅缓存模式下：
  - 单字拼贴只显示已有缓存
  - HD tile 补图按钮禁用

---

## 4. 缓存与持久化

### 4.1 核心 key

- `sprite_<codePoint>_<textureId>`：单字 PNG（base64）
- `mat_<codePoint>_<textureId>`：有机材质 HD tile（base64）
- `sprite_matted_v1_<codePoint>_<textureId>`：单字是否完成过一次抠底

### 4.2 fixtures 文件（可提交到 Git）

- 路径：`public/ai-letter-sprite-fixtures/sprites.json`
- 客户端读取策略：localStorage 优先，缺失再读 fixtures
- 写入接口：`POST /api/saveAiSpriteFixtures`
  - `next dev` 默认可写
  - `production` 需 `ALLOW_SPRITE_DISK_WRITE=1`

### 4.3 导入导出

- 导出全部 sprite 缓存为 JSON
- 导入 JSON 后可立即刷新到拼贴视图

---

## 5. 抠底策略（当前）

### 5.1 新生成单字

- `/api/generateLetterSprite` 返回后，客户端执行 `removeLetterSpriteBackground`
- 成功后写入 `sprite_*`，并标记 `sprite_matted_v1_* = 1`

### 5.2 历史缓存补救

- 进入单字拼贴时，不再全量重复抠底（防卡 UI）
- 对于未打 `sprite_matted_v1_*` 标记的缓存项，按字母队列做一次补救抠底
- 每个 `(码点, 材质)` 最多自动补救一次

---

## 6. 关键 API

### 6.1 `POST /api/generate`

- 入参：`text`, `texture`, `layout`
- 返回：
  - ASCII：`source: "three"`, `texture`, `perChar?`
  - 非 ASCII：`source: "mock"` + SVG

### 6.2 `POST /api/generateLetterSprite`

- 入参：`glyph`, `textureId`（必须 concrete，不能 `random/mixed/spriteCache`）
- 返回：单字图 base64 + mime

### 6.3 `POST /api/generateHdMaterial`

- 入参：`glyph`, `textureId`
- 仅接受 `moss/plush/knit/wood`

### 6.4 `POST /api/saveAiSpriteFixtures`

- 入参：`{ key, base64 }`
- 合并写入 `public/ai-letter-sprite-fixtures/sprites.json`

---

## 7. UI 交互要点

- Three 视图：拖拽平移、`Shift+拖拽` 旋转、`Shift+滚轮` 缩放、双击复位
- AI 拼贴：同样支持逐字位姿编辑，布局位姿保存在 localStorage
- “缓存材质”用于 demo/复用缓存：尽量保证输入字符串中每个字母都能从缓存命中显示；若确实无该码点缓存则显示缺失

---

## 8. 版本记录

| 版本 | 日期 | 说明 |
| --- | --- | --- |
| 2.0 | 2026-04-22 | 同步当前实现：每日 10 次额度、仅缓存 demo、`spriteCache` 材质、fixtures 读写、一次性抠底补救 |

---

文档结束。
