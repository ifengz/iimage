# Findings

## 2026-03-21

- 用户这次指出的是上一轮新增功能的回归问题，不是新需求：after 预览 hover 下载按钮位置错了，而且 after 图看起来也被带偏。
- 根因在 `src/styles.css`：`.preview-download-button` 先写了 `position: absolute`，但后面的通用 `.button` 又把同一个按钮改成了 `position: relative`。
- 因为下载按钮不再是悬浮层，它会作为 `preview-stage` 里的 flex 子项占位置，所以会出现在图片左边，还会把 after 图整体挤偏。
- 当前测试只验证“能不能点下载”，没有验证“按钮是不是悬浮层、会不会占布局位置”，所以这类回归之前没被挡住。
- 当前项目已经有 `FLOW.md`、`task_plan.md`、`findings.md`、`progress.md`，这轮直接续写，不另起新文档。
- 当前目录不是 git 仓库，不能依赖 `git status` 做脏文件判断，本轮继续以文件内容和验证命令为准。
- OpenSpec 的 `opsx propose`、`opsx apply`、`opsx archive` 都已成功记录到 `/Users/ifengz/.opsx/iimage/log.txt`。
- 最小修复是把预览下载按钮规则改成 `.button.preview-download-button`，这样即使通用 `.button` 规则写在后面，也盖不掉它的绝对定位。
- 审查里又发现一个真实使用问题：按钮平时只是“看不见”，但键盘还是能直接跳进去，这会让焦点突然落到一个肉眼看不到的东西上。
- 最终修复不只把按钮放回右上角，还让预览区本身先拿到焦点；按钮默认 `visibility: hidden`，只有 hover 或预览区聚焦时才会露出来。

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| 这轮只修下载按钮悬浮层和键盘入口，不顺手改别的 UI | 根因已经收敛到这一块，最小修复最稳 |
| 回归测试直接锁悬浮层和键盘入口 | 这次坏掉的是位置和可用性，不只是一条样式 |

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| `git status` 失败，提示当前目录不是 git 仓库 | 继续按文件与验证命令推进，不把 git 当成前提 |

## Resources

- `/Users/ifengz/Antigravity_Case/001_Daily_Work/iimage/src/components/PreviewPanel.tsx`
- `/Users/ifengz/Antigravity_Case/001_Daily_Work/iimage/src/styles.css`
- `/Users/ifengz/Antigravity_Case/001_Daily_Work/iimage/src/app.test.tsx`
- `/Users/ifengz/Antigravity_Case/001_Daily_Work/iimage/task_plan.md`
- `/Users/ifengz/Antigravity_Case/001_Daily_Work/iimage/FLOW.md`

## Visual/Browser Findings

- 用户截图里下载按钮跑到了图片左边，而且文字被挤成竖排，这和“按钮参与布局并被压缩”完全一致。
- 右上角红圈位置是用户期望的位置，说明目标不是改交互，而是把按钮恢复成真正的悬浮层。
- 本轮在真实浏览器里量了坐标：修复前按钮会跑到左边；修复后按钮回到 A 区右上角，图片继续居中。
