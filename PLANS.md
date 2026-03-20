# Codex Execution Plans (ExecPlans)

本文定义本仓库 ExecPlan 的写法和执行规则。目标是让一个完全不了解仓库的人，只看这一份规范和一份 ExecPlan，就能把功能做完并验证结果。

## 如何使用

当你要写 ExecPlan：
- 必须完整阅读本文件，再开始写计划。
- 先从骨架写起，再在调研过程中补全细节。
- 遇到术语要立刻解释成白话，并说明在本仓库对应到哪个文件或命令。

当你要按 ExecPlan 实施：
- 不要停在“下一步要做什么”的提问上，按里程碑连续推进。
- 每个停顿点都要更新计划里的进度状态和下一步动作。
- 遇到歧义要自主决策，并把原因写进 `Decision Log`。

当你要讨论或修改 ExecPlan：
- 把关键决策和改动原因记录到 `Decision Log`。
- 保证文档始终自洽，不能依赖“之前聊过但没写下来”的信息。

## 非协商要求

每份 ExecPlan 都必须满足：
- 自包含：当前版本包含完成任务所需的全部信息。
- 活文档：执行过程中持续更新，不是一次性文档。
- 新手可执行：默认读者不了解仓库和历史背景。
- 可观察结果：必须定义“怎么运行、看到什么才算成功”。
- 术语白话化：任何专业词都要解释，不解释就不要用。

## 写作与格式要求

- ExecPlan 用 Markdown 写，内容应以叙述为主，不要堆空洞清单。
- 允许列表，但只在必要处使用；`Progress` 必须使用勾选列表。
- 每个章节都要有明确目的，避免“只列标题不写可执行内容”。
- 如果一个 `.md` 文件只存放 ExecPlan 本体，可以不额外包裹三反引号。

## 必备章节

每份 ExecPlan 必须包含并持续维护以下章节：
- `Purpose / Big Picture`
- `Progress`（必须带时间戳和勾选项）
- `Surprises & Discoveries`
- `Decision Log`
- `Outcomes & Retrospective`
- `Context and Orientation`
- `Plan of Work`
- `Concrete Steps`
- `Validation and Acceptance`
- `Idempotence and Recovery`
- `Artifacts and Notes`
- `Interfaces and Dependencies`

## 里程碑要求

- 里程碑要讲清楚：目标、改动范围、预期结果、验证方式。
- 每个里程碑都要能独立验证，不能只说“代码已改”。
- 如果需要先做可行性验证，可以加“原型里程碑”，但必须写清楚升格或丢弃条件。

## 验证要求

- 必须提供可执行命令和预期输出。
- 验收标准要写成“人可观察行为”，不是内部实现细节。
- 要求尽量包含“改前失败、改后通过”的证据路径。

## 失败恢复与幂等

- 步骤要尽量可重复执行，不造成额外破坏。
- 对可能中断的步骤，必须写重试方法。
- 对有风险步骤，必须写回滚策略。

## ExecPlan 骨架（可复制）

按以下结构创建新计划文件：

    # <简短、动作导向的标题>

    This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

    PLANS.md path: /Users/ifengz/Antigravity_Case/开发规范/PLANS.md

    ## Purpose / Big Picture

    ## Progress

    - [ ] (YYYY-MM-DD HH:mm +TZ) 待办事项

    ## Surprises & Discoveries

    - Observation:
      Evidence:

    ## Decision Log

    - Decision:
      Rationale:
      Date/Author:

    ## Outcomes & Retrospective

    ## Context and Orientation

    ## Plan of Work

    ## Concrete Steps

    ## Validation and Acceptance

    ## Idempotence and Recovery

    ## Artifacts and Notes

    ## Interfaces and Dependencies

## 修订规则

每次修改 ExecPlan，必须在文档底部追加一条“变更记录”，写明：
- 改了什么
- 为什么改
- 这次改动影响哪个里程碑或验收标准
