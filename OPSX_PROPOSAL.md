# UI 重构 OpenSpec 提案 (OPSX_PROPOSAL.md)

## 任务背景
当前 UI 视觉效果欠佳，且组件架构过于耦合（App.tsx 巨石组件）。用户要求根据 `Shadcn-v4` 和 `impeccable_codex` 规范重构为“上下结构”的三卡片布局。

## 规范定义
1. **配色规范**: 采用 `Deep Studio` 主题，背景为深灰/蓝 (`oklch(0.15 0.02 240)`)，强调色为 `Gemini Blue` (`oklch(0.65 0.25 260)`)。
2. **字体规范**: Heading 使用 `Manrope`，正文/代码使用 `Geist` 系列。
3. **架构规范**: 
   - 提取业务逻辑到 `hooks/useAssets.ts`。
   - 拆分 UI 为原子层/组合层（Shadcn-v4 风格）。
   - 实现 A (预览)、B (编辑)、C (Prompt) 三卡片顶部并排布局。
   - 实现底部固定的操作栏与状态栏。

## 预期变更文件
- [NEW] `src/components/PreviewPanel.tsx`
- [NEW] `src/components/EditPanel.tsx`
- [NEW] `src/components/PromptPanel.tsx`
- [NEW] `src/components/ActionToolbar.tsx`
- [NEW] `src/components/StatusFooter.tsx`
- [NEW] `src/hooks/useAssets.ts`
- [MODIFY] `src/App.tsx` (清空 UI，仅作为容器)
- [MODIFY] `src/styles.css` (完全重写)

## 验证标准
1. 视觉对比：新 UI 需具备“高端感”，间距精准，配色和谐。
2. 功能回归：图片上传、规则编辑、Prompt 生成、模拟批处理功能需与旧版完全一致。
3. 响应式：在 1440px 及以上宽度保持三卡片并排。

/opsx:propose 完成。等待用户确认。
