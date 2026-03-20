# Progress

## 2026-03-21

- 已按流程读取并使用 `using-superpowers`、`brainstorming`、`systematic-debugging`、`planning-with-files`、`gsd-method-guide`、`test-driven-development`。
- 用户指出上一轮新增的 after 预览下载按钮位置错了，并怀疑它把 after 图一起顶偏。
- 已确认根因是 CSS 覆盖顺序错误：下载按钮本来要绝对定位，但被通用 `.button` 样式改回相对定位，结果按钮跑进布局里，after 图也跟着偏。
- 已执行新的 `opsx propose`，本轮目标切到“修预览下载悬浮层回归”。
- 已把本轮目标同步到 `task_plan.md`、`findings.md`、`progress.md`、`FLOW.md`。
- 已执行 `opsx apply`，并新增一条回归测试，先把这次错位问题锁死。
- 代码审查又指出一个真实问题：按钮没显示时，键盘也可能直接跳到这个看不见的按钮上。
- 已补第二个失败测试，并修成“预览区先拿焦点，按钮只在 hover 或聚焦时出现”。
- 已完成最小修复：把预览下载按钮的定位规则提到更高优先级，恢复为真正的悬浮层，同时补上键盘入口。
- 已完成验证：两个目标测试都先失败后通过，`src/app.test.tsx` 全部 20 条通过，全量测试 20 条通过，构建通过。
- 已做浏览器定位验证，并已执行 `opsx archive`。
- 开发服务器已关闭，没有残留本地 vite 进程。

## Test Results

| Test | Input | Expected | Actual | Status |
|------|-------|----------|--------|--------|
| 流程前置检查 | `git status --short` | 如果是 git 仓库应返回状态 | 当前目录不是 git 仓库 | 已记录 |
| OpenSpec 提案 | `opsx propose "修正 A 区 after 预览 hover 下载按钮错位；查清并修正 after 图位置被带偏的问题，确保按钮出现时不挤压、不改变图片位置，只作为悬浮层覆盖在预览右上角。"` | 提案成功记录 | 已写入 `/Users/ifengz/.opsx/iimage/log.txt` | 通过 |
| OpenSpec 落地 | `opsx apply` | apply 成功记录 | 已写入 `/Users/ifengz/.opsx/iimage/log.txt` | 通过 |
| 失败测试 1 | `npm test -- --run src/app.test.tsx -t "keeps the after preview download button as an overlay instead of letting it join layout"` | 先看到按钮定位回归失败 | 1 条失败，说明按钮悬浮层丢失 | 通过 |
| 失败测试 2 | `npm test -- --run src/app.test.tsx -t "lets keyboard users focus the after preview before revealing the download button"` | 先看到键盘入口缺失 | 1 条失败，说明预览区没法先拿到焦点 | 通过 |
| 组件测试 | `npm test -- --run src/app.test.tsx` | 全部通过 | 20 条通过 | 通过 |
| 全量测试 | `npm test -- --run` | 全部通过 | 20 条通过 | 通过 |
| 构建 | `npm run build` | 构建通过 | 构建通过 | 通过 |
| 浏览器定位验证 | Playwright 读取 `getBoundingClientRect()` | 按钮回到 A 区右上角，图片继续居中 | `buttonPosition: absolute`，按钮矩形位于 `stage` 右上 | 通过 |
| OpenSpec 归档 | `opsx archive` | archive 成功记录 | 已写入 `/Users/ifengz/.opsx/iimage/log.txt` | 通过 |

## Error Log

| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| 2026-03-21 02:40 | `git status` 报错当前目录不是 git 仓库 | 1 | 改为只依赖文件内容和验证命令 |

## 5-Question Reboot Check

| Question | Answer |
|----------|--------|
| Where am I? | Phase 5，这轮回归修复已经完成验证和 archive |
| Where am I going? | 对用户交付结果 |
| What's the goal? | 修复 after 预览 hover 下载按钮错位，并让 after 图恢复居中，还要避免看不见的按钮被键盘直接聚焦 |
| What have I learned? | 这次不是图片资源变了，而是悬浮按钮掉回布局流，把图片一起挤偏了；同时看不见的按钮也不能让键盘直接跳进去 |
| What have I done? | 已完成 propose/apply/archive、两条失败测试、样式修复、键盘入口修复、浏览器定位验证、测试和构建验证 |
