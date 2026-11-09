# 接入 AIadapter media-adapter，移除官方直连

> 历史提案，保留原始设计与本地开发决策，不视为生产批准或已完成归档。
> 当前开发分支已固定依赖为仓库内构建包，并保留已有的未分类模型手动尝试功能；
> 后者与下文严格能力准入设计有差异，生产方案仍需重新确认。当前状态见
> [README.md](README.md) 与 [提交审查](doc/core/commit-review.md)。

## 目标

把 iimage 的生图传输唯一收口到
`/Users/ifengz/CodingCase/AIadapter/media-adapter` 提供的
`newapi-media-client` 包。移除 `@google/generative-ai`、Gemini 官方 SDK
调用、前端多 key 轮换和本地复制版适配器；保留当前上传、规则编辑、Prompt
保存、选中图片批处理、并行上限、取消、结果下载/预览和本地 OCR 行为。

`media-adapter` 包是传输协议、鉴权、响应校验、模型目录和下载边界的唯一
source of truth。iimage 不再复制或分叉 `media-client.ts` / `media-config.ts`。

## 当前事实与决策门槛

- 当前工作树已存在用户未提交的接入草稿：`src/lib/media-client.ts`、
  `src/lib/media-config.ts` 以及相关 hook、设置组件和测试改动；本提案不覆盖、
  不回滚这些脏改动，apply 时只按本提案收口。
- iimage 是 Vite 静态前端；`vite.config.ts` 当前只把 `/api/*` 代理到
  `127.0.0.1:8787` 的 OCR 服务，没有图片生成或模型目录后端。
- `media-adapter/README.md` 明确要求生产项目由服务端保存 `NEWAPI_API_KEY`，
  `createConfiguredMediaClient(settings, apiKey)` 在服务端创建独立实例；key
  不得进入 `localStorage`、返回对象、错误信息或浏览器持久化配置。

因此，进入 `/opsx:apply` 前必须确认生产凭证路径：

1. **推荐路径：服务端持钥。** 用户指定一个已有的服务端/部署边界，提供同源
   图片编辑和模型目录接口；该服务端使用 `media-adapter`，key 来自环境变量或
   secret storage，浏览器只提交 prompt、参考图、模型/尺寸并接收脱敏结果。
   本提案不凭空新增或命名一个后端实现。
2. **仅本地开发路径：浏览器直连。** 若明确选择它，token 只能当次内存使用，
   禁止 localStorage/URL/日志持久化，并在 UI 标明“仅本地开发、生产禁止”。
   这不是生产验收路径；未得到该风险确认前停止 apply。

未选择上述路径，或没有可用的既有服务端承载点时，提案保持阻塞，不以把
token 从多行改成单行来宣称已经解决前端 secret 风险。

> **决策记录（2026-09-06）**：用户确认本工具不部署服务端、仅在开发环境使用，
> 选择路径 2（浏览器直连）。约束随之生效：token 仅当次会话内存使用，刷新页面
> 即失效重填，禁止 localStorage/URL/日志持久化；UI 标明"仅本地开发、生产禁止"。
> 生产发布仍被禁止；后续若需要上生产，必须回到路径 1 重新过凭证门槛。

## 设计

### 1. 包与调用边界

- iimage 依赖 AIadapter 的包入口（优先使用已发布/可部署的版本；仅本地验证
  时可使用 `file:../AIadapter/media-adapter`），不得 import 仓库内复制文件。
- 生图使用包的 `createMediaClient().generateImage(prompt, { model, images,
  size, signal })`；结果使用 `download()` 即取即存，再生成本地 Blob URL，
  不保存渠道临时 URL。
- 非幂等生图请求不在 iimage 重试，也不切换第二套协议；`MediaError` 原文
  进入现有失败状态。`AbortSignal` 必须贯穿参考图读取、生成请求和结果下载。
- 当前批处理调度、选中范围、并行数、状态统计、取消和结果回填留在
  `useAssets.ts`；adapter 只负责媒体传输。

### 2. 配置、凭证和模型发现

- 持久化配置只保留 `baseUrl`、`imageModel`、`imageSize`（以及业务所需的
  非敏感并行数）；不再保存 `apiKeys`、token 或 key 轮换索引。
- `baseUrl` 通过 adapter 的 `normalizeMediaBaseUrl` 校验；禁止 URL 凭证、query
  和 hash，允许路径前缀。
- 模型目录只调用一次明确的 `GET /v1/models`。候选分类只信任
  `supported_endpoint_types`：生图必须包含 `image-generation`；不根据 id、
  名称或 `owned_by` 猜能力。未分类模型可见为 warning，缺少合法生图候选才
  是 error；失效的已保存模型置空，不自动选 `default`。
- 服务端持钥路径下，模型目录也必须走既有服务端接口并只返回脱敏目录；浏览器
  不得直接持有 API key。直连路径下调用 adapter 的 `testConnection` 仅用于本地
  开发，输入完成后清空内存 token。

### 3. 行为保持

- Prompt 构造、参考图压缩为 image data URI、标准尺寸映射、批量顺序/并行、
  “只处理勾选项”、停止后不回填结果、失败显示、下载/预览 Blob URL 均保持。
- `/api/ocr`、OCR 手动触发、显示开关、before 点击顺序回填和现有 OCR 服务代理
  不改；OCR 不得改走 media-adapter。
- UI 中不再出现 Gemini 官方模型名或“API Keys（每行一个）”；模型下拉改为
  网关目录的合法生图模型，连接/目录错误必须可见。

## 预期变更文件

### iimage 必改

- `[MODIFY] package.json`：移除 `@google/generative-ai`，接入
  `newapi-media-client` 的可部署依赖；不把本机未构建目录当生产依赖。
- `[MODIFY] pnpm-lock.yaml`：仅更新上述依赖及其锁定内容。
- `[MODIFY] src/hooks/useAssets.ts`：删除 Gemini SDK、inlineData 提取、官方
  key 轮换和本地全局配置；调用选定的 adapter/同源图片接口，保留批处理与 OCR。
- `[MODIFY] src/components/ActionToolbar.tsx`：删除多 key 和写死 Gemini 选项；
  展示网关/模型目录的非敏感配置与连接状态，保留并行数、上传、开始、停止、下载。
- `[MODIFY] src/app.test.tsx`：从官方 SDK mock 改为 adapter 或同源图片接口边界
  的测试；覆盖 prompt/model/images/size/signal、下载转存、取消、并行和错误。
- `[MODIFY] README.md`、`FLOW.md`：更新为 adapter/网关和凭证决策门槛；保留
  OCR 启动与真实报错说明。
- `[DELETE] src/lib/media-client.ts`、`src/lib/media-config.ts`：迁移完成后
  删除当前工作树中的本地复制实现，避免双重 source of truth。

### 决策门槛文件

若选择服务端持钥路径，只能在用户指定既有服务端/部署边界后，补列该边界实际
拥有的路由、配置和部署文件；本提案不创建假定的 `image_api.py`、Node 服务或
secret 管理文件。若选择本地直连路径，不新增后端，但生产发布必须停止。

## 测试与验收

1. 在 adapter 源目录执行其既有 `npm test`、`npm run typecheck`、`npm run build`；
   这些测试是协议、模型目录、Base URL、非重试、取消和下载限制的权威单测。
2. 在 iimage 执行 `pnpm test -- --run`、`pnpm build` 和 `npm run ocr:check`。
   测试不得静默跳过；生产代码不得加入 mock 数据。
3. 静态检查确认不存在 `@google/generative-ai`、`GoogleGenerativeAI`、
   Gemini 官方模型名、`apiKeys` 多行轮换或浏览器持久化 token。
4. 真实 smoke 只允许在凭证路径通过后执行：一张真实图片、一个替换规则、一个
   合法网关生图模型，验证真实请求一次、结果下载为本地 Blob URL、页面可预览/下载；
   再验证一次无效网关/鉴权错误可见，以及停止生成不会回填结果。`GET /v1/models`
   成功或单元测试通过不等于真实生图 smoke 通过。
5. OCR smoke 单独调用现有 `/api/ocr`，确认本次媒体迁移没有改变 OCR 行为。

## 回滚与停止条件

- 任一 adapter 包测试、iimage 测试、构建或 OCR 检查失败，停止，不用 fallback、
  自动换模型或后处理补救。
- 网关模型目录缺少合法 `image-generation` 能力、Base URL/key 未通过校验、真实
  生图返回空/多图/无法下载、取消后仍回填结果，均停止并保留错误证据。
- 生产环境无法证明 key 只在服务端 custody，或只能依赖浏览器 localStorage/token，
  禁止发布；回滚到迁移前的官方链路只能由用户明确授权，且不把当前脏改动当成可回滚
  基线。
- 回滚只恢复本次 apply 实际修改的 iimage 文件和依赖锁定，不删除或覆盖用户其他
  未提交改动，也不修改 AIadapter 包目录。

本提案仅完成规范产出。请明确回复 **Yes** 后，才能执行 `/opsx:apply`；完成实现和
验收后再执行 `/opsx:archive`。
