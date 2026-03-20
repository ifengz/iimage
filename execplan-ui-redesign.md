# ExecPlan - UI 重构实施计 (execplan-ui-redesign.md)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md path: ./PLANS.md

## Purpose / Big Picture

对 `iimage` 进行彻底的 UI/UX 重构，从视觉平庸的旧版升级为基于 Shadcn-v4 和 Impeccable Codex 规范的高端工具界面。通过将逻辑与展示层解耦，提升代码可读性和扩展性。

## Progress

- [x] (2026-03-20 23:55 +08:00) 初始化 OpenSpec & ExecPlan 基础文件。
- [x] (2026-03-20 23:56 +08:00) 编写 OPSX_PROPOSAL 并提交通过（模拟 propose 环节）。
- [ ] (2026-03-20 23:57 +08:00) 提取逻辑层到 `hooks/useAssets.ts`。
- [ ] (2026-03-20 23:58 +08:00) 构建基础样式系统 (OKLCH, CSS Vars)。
- [ ] (2026-03-21 00:05 +08:00) 实现 A/B/C 三核心面板组件。
- [ ] (2026-03-21 00:15 +08:00) 实现底部控制与状态栏。
- [ ] (2026-03-21 00:25 +08:00) 最终集成与视觉微调。

## Surprises & Discoveries

- Observation:
  Evidence:

## Decision Log

- Decision: 重写 `styles.css` 而不是增量修改。
  Rationale: 旧样式高度耦合且配色混乱，重写更有利于落地高质量的 OKLCH 色彩体系。
  Date/Author: 2026-03-20 / Antigravity

## Outcomes & Retrospective

## Context and Orientation

- **核心逻辑文件**: `src/App.tsx` (目前包含所有状态和处理函数)。
- **核心样式文件**: `src/styles.css`。
- **目标组件架构**:
    - `App` (Layout)
        - `MainContent` (Grid: 3 cols)
            - `PreviewPanel`
            - `EditPanel`
            - `PromptPanel`
        - `BottomRail` (Grid: 2 rows)
            - `ActionToolbar`
            - `StatusFooter`

## Plan of Work

1. **逻辑解耦**: 先确保存储和处理逻辑不被 UI 变动破坏。
2. **样式先行**: 建立 design system。
3. **组件原子化**: 按照 A-B-C 的顺序逐个替换旧 UI。
4. **集成**: 拼装整页并处理响应式。

## Concrete Steps

1. 提取资产管理逻辑：`src/App.tsx` -> `src/hooks/useAssets.ts`。
2. 重定义 `src/styles.css` 中的 tokens。
3. 按顺序创建组件并注入逻辑 hook。

## Validation and Acceptance

- A区能实时预览 B区选中的图片。
- B区编辑规则能正确更新 C区的 Prompt 文本。
- 底部操作按钮逻辑正确调用 Hook 中的处理函数。
- UI 必须符合 Impeccable Codex 的 Bold 审美。

## Idempotence and Recovery

- 备份原始 `App.tsx` 和 `styles.css` 为 `.bak` 文件，以便随时回滚。

## Artifacts and Notes

- 参考设计规范: `/Users/ifengz/Antigravity_Case/002_DevelopSpec/Shadcn-v4`
- 参考审美指南: `/Users/ifengz/Antigravity_Case/002_DevelopSpec/impeccable_codex_reference`

## Interfaces and Dependencies

- 依赖: `lucide-preact` (或其他类似图标库，如果需要)。
- 接口: `useAssets` 提供 `assets`, `currentAsset`, `updateRule` 等方法。
