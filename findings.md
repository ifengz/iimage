# Findings

## 2026-03-21

- 用户这轮真正要修的是两件事，不是一件：A 区 OCR 覆盖层挡住原图，以及 OCR 回填只会写进第一个 `before` 框。
- `src/hooks/useAssets.ts` 已经是上传、当前图片、规则编辑的状态中枢，所以“是否显示 OCR”和“下一次该写哪个 before 框”都应该收在这里。
- 只把 OCR 框做透明一点不够，因为问题不只是颜色深浅，而是它默认就不该出现；正确做法是上传后不自动 OCR，并把显示开关交给用户。
- `src/components/PreviewPanel.tsx` 原本已经有 A 区底部可扩展空间，更适合挂 OCR 按钮栏；如果还放头部，位置和 B/C 区会明显不统一。
- OCR 提示继续浮在图上也不行，因为它会重新压住图片；真正合适的位置是底部按钮栏左侧。
- A 区按钮栏即使按钮本身样式对了，只要外层 `panel-body` 还保留默认 padding，视觉上也会比 B/C 区整体高一截。
- OCR 热区真正影响可读性的不是边框，而是热区内部直接渲染了一层识别文字；把文字拿掉，只留轻量边框，原图会清楚很多。
- 当前的 `applyOcrTextToTarget()` 只负责“写入当前目标”，没有“写完后把目标推进到下一个框”，所以用户连续点 OCR 时自然会一直写进同一个框。
- 这轮修正不需要改本地 OCR 服务协议，`/api/ocr` 返回的 `blocks` 结构已经够用，问题完全在前端交互层。
- 这次临时排查里又确认了一件事：服务不是“接口写坏了”，而是当时根本没在监听 `8787`；重新拉起以后，`/health` 和 `/api/ocr` 都正常。

## 2026-03-21 仓库整理与可访问性

- `tsconfig.app.json` 里现在还带着 `vitest/globals`，这会把测试专用东西塞进正式 app 边界，边界不够干净。
- `tsconfig.node.json` 直接编译 `vite.config.ts`，会顺手产出 `vite.config.js` 和 `vite.config.d.ts`；这就是为什么仓库里会出现两套 Vite 配置真相。
- `README.md` 里写的 AI SDK 名字和 `package.json` 不一致，新的接手人很容易照着装错包。
- `src/components/EditPanel.tsx` 里的缩略图 `前/后` 切换现在是 `div`，只能鼠标点，键盘用户没法直接切换视图。
- `scripts/dev-all.sh` 和 `ocr_server/app.py` 已经在工作区里了，但还是未跟踪状态；如果后面不把它们纳进仓库，文档里写的本地一键启动和 OCR 入口就会和干净仓库脱节。

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| 保持 `/api/ocr` 协议不变 | 这轮要修的是交互，不是后端返回格式 |
| OCR 手动触发，且默认隐藏热区 | 避免上传后立刻把图盖满，用户自己控制识别时机 |
| OCR 按钮栏放在 A 区底部，且沿用主按钮/幽灵按钮风格 | 这样才能和 B/C 区现有按钮区看起来是一套东西 |
| OCR 提示放进按钮栏左侧 | 这样不会再压图，同时能和按钮形成一条清楚的操作带 |
| OCR 热区只画边框，不在图上再渲染识别文字 | 识别文字已经在点击事件里能拿到，不需要再遮一层 |
| 每次回填后自动推进到下一个 before 框 | 用户录多条文字时最省操作，也最符合“往下填”的预期 |
| 到最后一个 before 框后不自动新增规则 | 用户没要求自动扩行，这轮只修“往下走” |
| OCR 服务看起来报错时，先分清是“没启动”还是“接口真的坏了” | 这次实际是服务没跑；启动后健康检查和识别接口都通过 |
| 测试类型不要混进 app 配置 | app 只管正式代码，测试边界更清楚 |
| 生成出来的 Vite 配置产物不要和源码并存 | 只有一套真相，后面才不容易改串 |
| 缩略图切换要做成按钮 | 键盘用户才能直接操作，不会被困在鼠标交互里 |

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| 原有文档仍然写“上传后自动 OCR” | 全部改成“手动 OCR + 显示开关” |
| OCR 顺序回填如果只靠 state，连续操作时容易拿旧目标 | 在状态层增加 `ocrTargetRuleIdRef`，让回填和推进用同一份即时目标 |
| 按钮虽然已经可点，但还挂在头部且竖排显示 | 改成 A 区底部按钮栏，右对齐横排，按钮类名归到 `button-primary` / `button-ghost` |
| 提示虽然正确，但还停在图上当浮层 | 改成底部按钮栏左侧提示，不再挡住图片 |
| 按钮本身已经对齐，但整条按钮栏还是浮得更高 | 继续往外层查，最后定位到 A 区 `panel-body` 默认 padding 没被清掉 |
| `tsconfig.app.json` 里混进了测试类型 | 计划把测试类型挪到单独的测试配置里 |
| `vite.config.js` / `vite.config.d.ts` 和 `vite.config.ts` 并存 | 计划收口成单一配置来源，并去掉生成产物 |
| B 区缩略图 `前/后` 还是鼠标控件 | 计划改成按钮，补键盘可达性 |

## Resources

- `/Users/ifengz/Antigravity_Case/001_Daily_Work/iimage/src/App.tsx`
- `/Users/ifengz/Antigravity_Case/001_Daily_Work/iimage/src/hooks/useAssets.ts`
- `/Users/ifengz/Antigravity_Case/001_Daily_Work/iimage/src/components/EditPanel.tsx`
- `/Users/ifengz/Antigravity_Case/001_Daily_Work/iimage/src/components/PreviewPanel.tsx`
- `/Users/ifengz/Antigravity_Case/001_Daily_Work/iimage/src/data/mock.ts`
- `/Users/ifengz/Antigravity_Case/001_Daily_Work/iimage/src/styles.css`
- `/Users/ifengz/Antigravity_Case/001_Daily_Work/iimage/src/app.test.tsx`
- `/Users/ifengz/Antigravity_Case/001_Daily_Work/iimage/task_plan.md`
- `/Users/ifengz/Antigravity_Case/001_Daily_Work/iimage/FLOW.md`
- `/Users/ifengz/Antigravity_Case/001_Daily_Work/iimage/execplan-local-paddleocr.md`
- `/Users/ifengz/Antigravity_Case/001_Daily_Work/iimage/scripts/dev-all.sh`

## 2026-03-21 仓库整理与可访问性

- `tsconfig.app.json` 需要去掉 `vitest/globals`，测试类型应该放到单独的测试配置里。
- `vite.config.js` 和 `vite.config.d.ts` 是 `tsconfig.node.json` 产出的副作用，不该和 `vite.config.ts` 并存。
- `README.md` 的 AI SDK 名称要改成 `@google/generative-ai`，才能和 `package.json` 保持一致。
- `EditPanel` 的缩略图 `前/后` 切换适合直接变成按钮，不需要额外发明一套键盘事件处理。

## Visual/Browser Findings

- 用户上传图片后，A 区不该马上进入“满屏 OCR 框”状态，先给用户看原图更合理。
- 对这类“先选 before 框，再点图上文字”的工具来说，A 区和 B 区之间必须有一个明确的当前接收框指针，否则多行输入一定会乱。
- OCR 框能点即可，不需要把识别文本也始终印在图片上；否则越长的文字，越容易把底图盖住。
- 用户对“是不是一样”看的不只是按钮名字，还会看它是在头部还是底部、是一排还是一列、是不是同一套边框和填充。
- 用户对“样式一样吗”还会直接看高度、字号和悬浮反馈；只要 OCR 按钮单独写了一套尺寸，肉眼就会觉得不是同一个系统。
- 用户说“直接去看 B/C 区按钮代码”时，不能只抄按钮样式；还要把外层容器一起对齐，否则按钮还是会飘在另一条线上。

## 2026-03-21 A/B/C 底部按钮栏彻底统一

- A 区之前还保留了 `preview-actions-bar`、`preview-actions-group`、`preview-ocr-action` 这套预览区专用类，所以即使高度和字号压到一样，视觉上也还是像另一套实现。
- 真正能把三块面板收成一条线的，不只是按钮尺寸，还包括 `panel-body` 的统一外层约束；A/B/C 都必须明确写成 `padding: 0`、`display: flex`、`flex-direction: column`、`min-height: 0`、`overflow: hidden`。
- 把共享底部按钮栏和紧凑按钮尺寸提到独立常量文件后，A 区“开始 OCR”、B 区“清空/重置”、C 区“重置/保存”就不再各写一套数字，后续也更难再漂。
- 这类“看起来是不是同一套”的问题，`jsdom` 只能锁结构和样式参数，最后还是要回真实浏览器截图确认，不能只看单测通过。

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| 去掉 A 区底部栏链路上的预览专用类 | 让 A 真正直接走和 B/C 一样的共享底部栏结构 |
| 抽 `sharedPanelBodyStyle` 和紧凑按钮样式常量 | 用同一份代码约束 A/B/C 的外层和按钮尺寸，避免再次分叉 |
| 把 disabled 态下沉到通用 `.button[disabled]` | 不再只给 A 区 OCR 按钮单独写禁用态外观 |
| 浏览器上传真实图片再看底部栏 | 用户纠正的是运行态视觉问题，最终必须用真实页面收口 |

## 2026-03-21 B区默认替换规则显示10条

- `src/components/EditPanel.tsx` 本身没有写死“只显示 1 条”，它只是把 `currentAsset.rules` 原样渲染出来，所以问题根源不在 B 区组件。
- 真正的默认条数来自 `createDevelopmentAssetFromFile()`；这里现在只塞了 1 条空白规则，所以新图片天然只会看到 1 行。
- `handleUpload()` 和 `handleSlotUpload()` 都走 `createDevelopmentAssetFromFile()`，说明新上传图片和替换插槽上传图片会一起受影响。
- `clearCurrent()` 现在只是把现有规则清空内容，不会把规则数量恢复成默认值；如果要“重置后还是 10 条”，这里也要一起改。
- 这轮需求还没说要限制用户删减规则数量，所以更稳妥的范围是“默认给 10 条”，不顺手改删除按钮和新增按钮的后续行为。

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| 把默认规则工厂抽到数据层 | 新建图片和替换插槽都能复用，避免到处写死 10 |
| 重置当前图片时恢复默认条数 | 用户说的是“默认显示 10 条”，重置后应回到默认状态 |
| 先不改 B 区渲染层循环逻辑 | 渲染层已经按数据原样输出，直接改数据源最短 |
| 新默认规则继续允许后续新增和删除 | 这轮只改默认起点，不顺手改掉用户已有编辑习惯 |

## 2026-03-21 修 review 发现的 3 个问题

- 这轮不是“再看看 UI 细节”，而是 3 个已经被 review 和浏览器跑出来的真问题：批处理状态会误伤没勾选的图；坏图上传失败时页面不说话；README 还在教用户走旧 OCR 流程。
- 批处理状态错位的根因在 `startBatch()`：前面已经按 `selectedIds` 算出了 `readyItems`，后面把状态切到“处理中”时却还是按“所有就绪图片”去改，所以没勾选的图也会被误标。
- 坏图上传没提示的根因在上传链路：`readImageDimensions()` 失败会直接抛错，但 `handleUpload()` / `handleSlotUpload()` 没把错误收成页面消息；上传入口的 `onChange` 也只是直接调函数，所以用户肉眼看到的就是“点了没反应”。
- OCR 文档写反不是小问题。真实页面已经改成“先上传，再手动点开始 OCR”，如果 README 还写“上传后自动识别”，用户会直接以为 OCR 坏了。
- 这轮修复最短路径不是改更多交互，而是先把“状态只改勾选项”“坏图失败要露到页面”“README 和页面同口径”这 3 条链路收干净。
- 实现上最终收成了两条短链路：批处理开始前先把真正要跑的图片 id 收成 `Set`，状态只改这批；上传链路统一走 `createUploadAsset()`，失败时把错误转成页面底部可见消息，并在坏图场景下及时释放预览 URL。
- 浏览器复测已经确认两件事：上传 `/tmp/bad.png` 后，页面底部能直接看到“无法读取图片尺寸。”；上传真实图片后，A/B 两区继续明确提示先点“开始 OCR”，和 README 新步骤一致。

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| 批处理状态更新必须改成只遍历勾选且要跑的图片 | 这才和用户的选择一致，避免出现“没选中的图也在跑” |
| 坏图上传失败直接显示在页面上 | let it crash 的前提是把错误暴露给用户，不是只留在控制台 |
| README 直接按当前运行态改写 OCR 步骤 | 文档必须服务现在这版页面，不能继续保留旧交互口径 |
| 这轮先不顺手改 OCR 服务协议和部署方式 | review 已经把最影响当前使用的 3 个问题收敛清楚，先按最短路径修完 |

## 2026-03-21 本地启动步骤与一键脚本

- `npm run dev:all` 适合本地日常开发：它先检查 OCR 服务健康状态，健康就直接起前端，不健康就先起 OCR，再起前端。
- 这个脚本不需要引入额外依赖，直接用 `bash` 包住现有的 `npm run ocr:server` 和 `npm run dev` 就够了，维护成本最低。
- README 里同时保留“手动分开启动”和“一键启动”两种写法更稳：有人想看清每一步，有人只想一句命令跑起来。
- Vite 的前端端口不能写死。只要 `5173` 已占用，它就会自动顺延到别的端口，所以文档里要写“以终端输出为准”。
- 本地 smoke test 已确认：OCR `/health` 正常，前端主页可访问。

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| `dev:all` 先确认 OCR 健康，再启动前端 | 前端不用先起起来等后端，减少用户看到一堆错误的机会 |
| README 保留手动启动和一键启动两种入口 | 兼顾想细控流程的人和只想快速跑起来的人 |
| 前端端口写“以终端输出为准” | Vite 会在端口被占用时自动顺延，写死 5173 会误导用户 |

## 2026-03-21 修 review 发现的另外 5 个问题

- 顶部批量上传和 B 区缩略图一直不是同一个边界：顶部入口原来能一直往 `assets` 里加，B 区却只有 6 个可见格子，所以真正的问题不是“文案不一致”，而是状态里会出现用户再也点不到的图片。
- “同一张图重传像失灵”不是上传逻辑没跑，而是浏览器对 file input 的常见行为：处理完后如果不把 `value` 清掉，再选同一张文件通常不会再触发 `change`。
- 这次最稳的做法不是去硬模拟浏览器的二次选同文件，而是直接锁住处理完成后 `input.value === ""`，因为这正是根因上的防线。
- 缩略图状态点之前只有“成功=绿，其他全红”，所以就绪和处理中也会看起来像失败；真正要改的是状态到颜色的映射，不是随便换一个默认色。
- README 这轮漏掉的是两个真实使用前提：开始生成前要先勾选图片；`dist` 只是前端静态资源，OCR 仍然依赖同源接口或反向代理。漏任何一个，用户都会误判成页面坏了。

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| 抽 `MAX_ASSET_SLOTS = 6` 给上传和 B 区共用 | 不让“顶部能传、B 区看不见”这种分叉再出现 |
| 用 file input 清空值来保证同图可重传 | 这是浏览器层面的根因修法，不是 UI 小技巧 |
| 状态点给测试锚点 `data-thumb-status` | 回归测试能稳定盯住状态映射，不再靠脆弱选择器 |
| README 同时补操作步骤和部署前提 | 一个解决“按钮没反应”的误会，一个解决“OCR 404”的误会 |
