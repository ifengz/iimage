# 接入 NewAPI 媒体适配层，删除官方直连 (OPSX_PROPOSAL_V5.md)

> 历史草案，已被 `OPSX_PROPOSAL_AIADAPTER.md` 的包入口方案取代。
> 不再复制适配源码、不使用全局连接状态或自动重投计费请求；本文件不作为当前实施指令。

> 依据：`/Users/ifengz/CodingCase/AIadapter/media-client.ts` + `MEDIA-INTEGRATION.md`（其中第四节正是针对 iimage 的清理指引）

## 背景

当前 iimage 前端直连 Google 官方：

| 现状 | 问题 |
|------|------|
| `useAssets.ts` 里 `new GoogleGenerativeAI(apiKey)` + `model.generateContent(...)` | 渠道 key 明文存浏览器，泄露风险；渠道挂了没法换 |
| 设置页 `apiKeys` 多行明文列表，请求按 index 轮换 key | key 轮换是网关的职责，前端不该管 |
| 模型下拉写死 4 个 `models/gemini-*` / `imagen-*` | 换模型要改代码，且直连官方没有降级 |
| 依赖 `@google/generative-ai` | 官方 SDK 专用，切网关后无用 |

目标：项目侧只留"我要什么图"（prompt、模型名、参考图），一切"怎么找渠道、挂了怎么办、key 怎么轮换"上交 NewAPI 网关。

## 方案

### 1. 加适配层：拷入 `src/lib/media-client.ts`

从 AIadapter 原样拷入，做两处本地化微调（不改变对外语义）：

- `GenerateOptions` 增加可选 `signal?: AbortSignal`，透传给内部 `fetch`——现有"停止生成"依赖 abort，适配层必须支持取消。
- 其余重试 / 轮询 / 超时补查逻辑保持原样，不自建第二套容错。

### 2. 改 `useAssets.ts`：出图链路切到 `generateImage()`

- 删除 `@google/generative-ai` import、`extractResultImageUrl`、`urlToBase64` 的 inlineData 用法。
- `startBatch` 内改为：

  ```ts
  const img = await generateImage(prompt, {
    model: settings.model,
    images: [dataUri],        // 参考图仍是 data:URI（见下方"已知取舍"）
    size: 按原图宽高映射到最近的标准尺寸,
    signal: controller.signal,
  });
  const bytes = await download(img.url);   // 加固 2：临时链接即取即存
  const resultUrl = URL.createObjectURL(new Blob([bytes])); // 转 blob URL 供预览/下载
  ```

- 结果不再存渠道 URL，`resultUrl` 用本地 blob URL（组件卸载/替换时 revoke）。
- 错误处理沿用 `MediaError`：`message` 直接进 `errorMessage`，不再自己判重试（客户端已内置重投一次）。

### 3. 设置页收敛（`ActionToolbar.tsx`）

多 key 列表 → 两个字段 + 模型 + 并行数：

| 字段 | 说明 |
|------|------|
| 网关地址 baseUrl | 默认 `http://localhost:3000`，可被 `NEWAPI_BASE` 环境变量兜底 |
| 令牌 key | 单个 `sk-` 令牌 |
| 模型 | 改为网关侧模型名：`nano-banana-2`（默认）、`seedream-4.0`、`gpt-image-1` 等 |
| 并行数 | 保留不变 |

`settings` 变更时调 `configureMedia({ baseUrl, key })` 注入（在 `updateSettings` 里做，应用启动时也用初始值注入一次）。

### 4. 删除官方直连残留

- `package.json` 移除 `@google/generative-ai` 依赖。
- `app.test.tsx`：`vi.mock('@google/generative-ai')` 整套换成 `vi.mock('../lib/media-client')`（mock `generateImage` / `download` / `MediaError` / `configureMedia`），断言从"检查 inlineData / getGenerativeModel"改为"检查 generateImage 的 prompt / model / images / signal 入参"。
- 组件文案里的 "Gemini" 字样（PromptPanel 标题、EditPanel placeholder、PreviewPanel 提示）改为中性"模型"表述。
- `StatusFooter` 的 model 展示逻辑不变（值换成网关模型名即可）。
- `FLOW.md` / `README.md` 中直连 Gemini 的描述同步更新。

## 已知取舍（需要你知情）

1. **参考图仍走 data:URI**：文档纪律说"参考图传 URL 别传 base64"，但 iimage 是纯前端、没有图床/OSS，本地上传的图只能转 data URI 提交。批量图一般 ≤2MB/张，可接受；若后续撞大小限制，再补一个上传转存环节。
2. **令牌仍存在浏览器**：文档建议后端调用，但按 MEDIA-INTEGRATION.md 第四节对 iimage 的既定方案，就是"设置页收敛为网关地址 + 一个令牌"。相比原来多渠道 key，泄露面已从"官方 key"缩小为"可吊销的网关令牌"。
3. **生图 size 参数**：网关侧是 OpenAI 格式，需传标准尺寸；按原图宽高比映射到最近的允许值（如 1024x1024 / 1536x1024 / 1024x1536），出图比例可能与原图有细微差异——原来 Gemini inlineData 链路没有这个约束。

## 预期改动文件

- [ADD] `src/lib/media-client.ts`
- [MODIFY] `src/hooks/useAssets.ts`（核心链路替换）
- [MODIFY] `src/components/ActionToolbar.tsx`（设置页收敛）
- [MODIFY] `src/components/PromptPanel.tsx` / `EditPanel.tsx` / `PreviewPanel.tsx`（文案）
- [MODIFY] `src/app.test.tsx`（mock 与断言重写）
- [MODIFY] `package.json` / `pnpm-lock.yaml`（删依赖）
- [MODIFY] `FLOW.md`、`README.md`

## 验证标准

1. `pnpm test -- --run` 与 `pnpm build` 通过；代码中不再出现 `@google/generative-ai` / `GoogleGenerativeAI` / 多 key 轮换逻辑。
2. 设置页只有"网关地址 + 令牌 + 模型 + 并行数"四项；不填网关配置点生成时给出明确提示。
3. 配置好网关后跑一批：出图成功、结果可预览可下载；断网/错误网关时报错信息透传网关原文且状态置"失败"。
4. 生成中点"停止生成"能中止在途请求（signal 生效），不出现结果回填。
5. OCR 本地链路（`/api/ocr`）不受影响。

---

**等你确认后执行 `/opsx:apply` 落地；完成后按流程补 `/opsx:archive`。**
