# OpenSpec 工作流约束（项目级）

适用范围：本仓库内所有功能开发、重构、较大改动。

## 必须遵守

1. 先做规范，不要直接改代码。
2. 进入实现前，必须先执行 `/opsx:propose <需求描述>`。
3. `propose` 产出后，必须等待用户明确确认；未确认前禁止执行 `apply`。
4. 用户确认后，才能执行 `/opsx:apply` 落地代码。
5. 完成后必须执行 `/opsx:archive` 归档本次规范与变更。

## 执行提示（给 Codex）

- 默认按 OpenSpec 流程推进，除非用户明确要求跳过。
- 若 slash 命令不可用，先提示用户检查 OpenSpec 安装与会话加载状态，再继续。

# ExecPlans

当任务属于复杂功能、跨模块重构、或预期持续数小时时，必须先写并维护 ExecPlan。

- ExecPlan 规范文件路径：`/Users/ifengz/Antigravity_Case/开发规范/PLANS.md`
- 默认示例计划路径：`/Users/ifengz/Antigravity_Case/开发规范/execplan.md`
- ExecPlan 是“活文档”：执行中必须持续更新 `Progress`、`Decision Log`、`Surprises & Discoveries`、`Outcomes & Retrospective`
