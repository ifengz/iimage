# 本地 PaddleOCR 服务接入与点击回填

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md path: `/Users/ifengz/Antigravity_Case/001_Daily_Work/iimage/PLANS.md`

## Purpose / Big Picture

这次改动要把“本地 OCR 服务 + 手动识别 + 顺序回填”真正落地。用户不应该再手抄图片里的字，也不应该一上传图片就被 OCR 框挡住。对用户来说，可见行为应该是四件事：上传图片后先看到干净原图；需要时再点 A 区底部按钮栏里的“开始 OCR”；需要时再点“显示 OCR”看热区；点中某段字后，B 区的 before 输入框自动带上那段字，并且下一次会继续往下一个 before 框填。

要做到这点，必须补一个本地 OCR 后端进程。浏览器页面本身不能直接运行 PaddleOCR，也不该知道 Python 包、模型下载和本地硬件细节。所以本计划固定采用“两层结构”：前端只打本地 `/api/ocr`，本地 Python 服务负责真正跑 PaddleOCR 并返回文字和坐标。

## Progress

- [x] (2026-03-21 16:05 +08:00) 读取当前前端结构，确认项目是纯前端，没有现成 OCR 服务。
- [x] (2026-03-21 16:18 +08:00) 完成 OpenSpec propose/apply，收敛为“本地 OCR 服务 + A 区热区 + before 回填”方案。
- [x] (2026-03-21 16:25 +08:00) 更新计划文档和流程图，替换旧的下载按钮回归目标。
- [x] (2026-03-21 16:35 +08:00) 先补失败测试，锁住 OCR 请求、热区覆盖和点击回填。
- [x] (2026-03-21 16:50 +08:00) 创建 `ocr_server/` 本地服务骨架与启动说明。
- [x] (2026-03-21 17:10 +08:00) 接通前端上传链路、OCR 状态、热区覆盖与 before 回填。
- [x] (2026-03-21 17:40 +08:00) 跑前端测试、构建、Python 语法检查和本地服务验证。
- [x] (2026-03-21 11:15 CST) 根据用户纠正，确认要把“自动 OCR”改成“手动触发 + 显示开关”，并补上“顺序回填”。
- [x] (2026-03-21 11:25 CST) 更新前端状态层和 A/B 区交互，完成手动 OCR、轻量热区和顺序回填。
- [x] (2026-03-21 11:39 CST) 跑定向测试、全量测试、构建和 Python 语法检查。
- [x] (2026-03-21 11:44 CST) 执行 OpenSpec archive。
- [x] (2026-03-21 11:46 CST) 根据用户继续纠正，把 OCR 按钮从 A 区头部移到 A 区底部按钮栏，并对齐 B/C 区按钮风格。
- [x] (2026-03-21 11:49 CST) 把 OCR 提示移进按钮栏左侧，并让按钮高度、字号和过渡方式与 B/C 区一致。
- [x] (2026-03-21 11:51 CST) 继续对齐 A/B/C 三块按钮栏，确认并清掉 A 区 `panel-body` 的默认 padding。

## Surprises & Discoveries

- Observation: 项目规范里提到的 `/Users/ifengz/Antigravity_Case/开发规范` 路径在本机不存在。
  Evidence: `ls /Users/ifengz/Antigravity_Case/开发规范` 返回 `No such file or directory`。

- Observation: 当前图片对象的宽高还是写死的 `1600 × 900`，这对 OCR 坐标映射不可靠。
  Evidence: `src/data/mock.ts` 里 `createDevelopmentAssetFromFile()` 直接返回 `width: 1600`、`height: 900`。

- Observation: A 区当前已经有一个 `preview-stage` 容器，可作为 OCR 热区覆盖层的根容器。
  Evidence: `src/components/PreviewPanel.tsx` 里 before/after 预览都走 `.preview-stage`。

- Observation: `.venv-ocr` 里只装 `paddleocr` 还不够，真正跑识别前还得补 `paddlepaddle`。
  Evidence: `.venv-ocr/bin/python -c "import paddle"` 初次返回 `ModuleNotFoundError: No module named 'paddle'`。

- Observation: PaddleX 默认缓存目录是 `~/.paddlex`，在当前受限环境里会触发权限问题。
  Evidence: 初次导入 `paddleocr` 时直接报 `PermissionError: [Errno 1] Operation not permitted: '/Users/ifengz/.paddlex'`。

- Observation: M3 MacBook Pro + Python 3.12.3 最终能装上并跑通 `paddlepaddle 3.3.0` 与 `paddleocr 3.4.0`。
  Evidence: `.venv-ocr/bin/python -m pip install paddlepaddle` 成功，随后 `curl -F "file=@/tmp/ocr-smoke.png" http://127.0.0.1:8787/api/ocr` 返回 `Summer Sale`。

- Observation: OCR 热区内部直接渲染文字时，会把原图信息盖住，看图体验很差。
  Evidence: 用户截图中 OCR 文本标签大面积压在原图内容上，已经影响辨认。

- Observation: 当前回填逻辑只会写当前目标，没有在写完后自动推进到下一个 before 框。
  Evidence: `src/hooks/useAssets.ts` 里的旧 `applyOcrTextToTarget()` 只有“找到目标并写入”，没有任何“更新下一个目标”的逻辑。

## Decision Log

- Decision: 本地 OCR 服务使用独立的 Python 目录 `ocr_server/`，而不是把 OCR 包塞进 Node 侧。
  Rationale: PaddleOCR 本身是 Python 生态，分开后依赖边界更干净，前端只保留接口调用逻辑。
  Date/Author: 2026-03-21 / Codex

- Decision: 前端统一调用 `/api/ocr`，并通过 Vite 代理转发到本地 OCR 服务。
  Rationale: 开发时不需要改前端域名；以后如果换端口或把后端包进桌面壳，前端代码都不用动。
  Date/Author: 2026-03-21 / Codex

- Decision: OCR 点击回填默认落到当前图片的第一个 before 输入框；用户手动聚焦其他 before 输入框时，回填目标随之切换。
  Rationale: 单规则场景不增加操作，多规则场景也有明确目标，不会把文字误写进 target 或 notes。
  Date/Author: 2026-03-21 / Codex

- Decision: 上传后不自动 OCR，A 区右上固定提供“开始 OCR”和“显示/隐藏 OCR”两个入口。
  Rationale: 识别与显示要分开，用户先看原图，再决定什么时候识别、什么时候显示热区。
  Date/Author: 2026-03-21 / Codex

- Decision: OCR 按钮入口从 A 区头部移到 A 区底部按钮栏，并沿用主按钮/幽灵按钮的样式家族。
  Rationale: 这样位置和视觉语言才能和 B/C 区统一，不会出现“能用但看起来不是一套”的问题。
  Date/Author: 2026-03-21 / Codex

- Decision: OCR 提示不再浮在图片上，改为放到 A 区底部按钮栏左侧。
  Rationale: 这样不会挡图，用户也能在同一条操作带里同时看到状态和按钮。
  Date/Author: 2026-03-21 / Codex

- Decision: A 区 `panel-body` 直接清零 padding，由内部 `preview-content` 自己负责留白。
  Rationale: 这样 A 区底部按钮栏才能和 B/C 区真正在同一条线上，而不是被外层容器抬高。
  Date/Author: 2026-03-21 / Codex

- Decision: OCR 回填后自动把接收目标推进到下一个 before 框；到最后一个 before 框后停在最后一个。
  Rationale: 这样最贴合“2、3、4、5 往下填”的预期，又不会擅自新增规则。
  Date/Author: 2026-03-21 / Codex

## Outcomes & Retrospective

这轮目标已经完成：本地 OCR 服务、前端 OCR 状态、A 区手动按钮、轻量热区和 before 顺序回填都已经接通，且前端测试、构建、Python 语法检查都已通过。剩余注意点主要有两个：一是首次识别会触发模型下载，第一次会慢；二是如果后面用户还想做“自动分段填表”，那就是新需求，不属于这轮“顺序往下填”的修复。

## Context and Orientation

这轮会碰到三块代码：

- 前端状态层：[src/hooks/useAssets.ts](/Users/ifengz/Antigravity_Case/001_Daily_Work/iimage/src/hooks/useAssets.ts)
  这里管上传、当前图片、规则、批处理，也是 OCR 结果最合适的落点。

- 前端界面层：[src/components/EditPanel.tsx](/Users/ifengz/Antigravity_Case/001_Daily_Work/iimage/src/components/EditPanel.tsx) 和 [src/components/PreviewPanel.tsx](/Users/ifengz/Antigravity_Case/001_Daily_Work/iimage/src/components/PreviewPanel.tsx)
  前者负责 before/after 规则输入，后者负责显示图片和 OCR 热区。

- 本地服务层：`ocr_server/`
  这里单独放 FastAPI 服务、PaddleOCR 依赖清单、启动命令和必要的报错出口。

“OCR 热区”在这里的白话意思是：把识别出来的文字位置，画成一块块能点的透明框。用户不是点一整张图，而是点这些框。

## Plan of Work

先锁测试，再补本地服务，再接前端。这样能避免出现“服务看起来跑起来了，但前端点了没反应”的假完成状态。顺序上分四个里程碑：

1. 用测试把新行为钉死。
2. 把本地 OCR 服务骨架搭起来，明确接口输入输出。
3. 把前端图片状态补上 OCR 数据，但改成手动请求。
4. 把 A 区热区和 B 区回填串起来，并在每次回填后推进到下一个 before 框。

## Concrete Steps

1. 更新 `task_plan.md`、`findings.md`、`progress.md`、`FLOW.md`、本 ExecPlan，把旧任务切到 OCR 服务器目标。
2. 在 `src/app.test.tsx` 增加失败测试：
   - 上传后调用 `/api/ocr`
   - A 区渲染 OCR 热区
   - 点击热区后 before 输入框被写入文字
3. 新建 `ocr_server/app.py` 和 `ocr_server/requirements.txt`，固定接口为：
   - `GET /health`
   - `POST /api/ocr`
4. 改前端状态：
   - `AssetItem` 增加 `ocrStatus`、`ocrBlocks`、`ocrErrorMessage`
   - 上传后不自动发 OCR 请求
   - 记住当前 `before` 接收框，并在回填后推进到下一个框
5. 改 A/B 区组件：
   - A 区底部增加按钮栏，热区默认隐藏且只画轻量边框
   - B 区 source 输入框聚焦后切换接收目标
6. 通过 `vite.config.ts` 加本地代理，避免开发时跨域
7. 跑验证并记录结果

## Validation and Acceptance

验收标准要用人能看见的话描述：

- 上传图片后，页面不会自动 OCR，也不会马上把图盖住。
- 点“开始 OCR”后，页面能显示 OCR 状态，不是静默失败。
- OCR 成功后，只有点“显示 OCR”才会出现一块块可点文字框。
- 连续点多块文字后，B 区 before 输入框会按顺序往下填。
- A 区 OCR 按钮栏在底部，并且按钮风格和 B/C 区同一套。
- OCR 服务没启动或识别报错时，页面能看到真实错误提示，不会偷偷用假数据顶上。

可执行验证命令：

    npm test -- --run src/app.test.tsx
    npm run build
    python3 -m py_compile ocr_server/app.py
    curl -i http://127.0.0.1:8787/health

如果本机能装好依赖，再补一条真实接口验证：

    curl -i -X POST http://127.0.0.1:8787/api/ocr

## Idempotence and Recovery

这轮新增的本地服务是独立目录，失败时不会破坏现有前端生成逻辑。恢复方式如下：

- 前端代理或 OCR 逻辑有问题：回滚 `src/` 改动，页面仍可回到“无 OCR”的旧行为。
- Python 服务有问题：删除 `ocr_server/`，前端会直接暴露接口不可用错误，不会误用假数据。
- 模型下载中断：保留服务目录，重新安装依赖并重新启动，不需要改前端代码。

## Artifacts and Notes

计划中的关键产物：

- `ocr_server/app.py`
- `ocr_server/requirements.txt`
- `execplan-local-paddleocr.md`
- `src/hooks/useAssets.ts`
- `src/components/PreviewPanel.tsx`
- `src/components/EditPanel.tsx`
- `vite.config.ts`

关键接口草案：

```json
{
  "blocks": [
    {
      "id": "block-1",
      "text": "618 限时折扣",
      "score": 0.98,
      "box": { "x": 120, "y": 64, "width": 260, "height": 54 }
    }
  ]
}
```

真实验证结果：

- `GET /health` 返回 `{"status":"ok"}`
- `POST /api/ocr` 对本地测试图返回：

```json
{
  "blocks": [
    {
      "id": "block-1",
      "text": "Summer Sale",
      "score": 0.9887199401855469,
      "box": { "x": 70, "y": 131, "width": 600, "height": 110 }
    }
  ]
}
```

## Interfaces and Dependencies

前端依赖：

- `fetch('/api/ocr')`
- `vite.config.ts` 里的本地代理

本地服务依赖：

- `fastapi`
- `uvicorn`
- `paddleocr`
- `python-multipart`

PaddleOCR 官方参考：

- [PaddleOCR GitHub](https://github.com/PaddlePaddle/PaddleOCR)
- [PaddleOCR OCR Usage Tutorial](https://www.paddleocr.ai/v3.3.0/en/version3.x/pipeline_usage/OCR.html)

---
变更记录（2026-03-21）：首次创建本计划文件，目标是把“本地 PaddleOCR 服务 + OCR 热区点击回填 before”从口头需求落成可执行的实现文档。
变更记录（2026-03-21）：补充真实安装与验证结果，记录了 M3 + Python 3.12 本机已跑通 PaddleOCR 的证据，并记下缓存目录和运行时依赖这两个实际坑。
