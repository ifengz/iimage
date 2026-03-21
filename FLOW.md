# Project Workflow (FLOW.md)

```mermaid
graph TD
    Start[开始] --> Review[读取当前 OCR 状态与用户纠正]
    Review --> Propose[OpenSpec Propose: 手动 OCR + 顺序回填]
    Propose --> Apply[OpenSpec Apply]
    Apply --> Docs[更新 task_plan / findings / progress / ExecPlan / lessons]
    Docs --> RedTest[先补失败测试: 手动 OCR / 显示开关 / 顺序回填]
    RedTest --> State[改 useAssets: 不自动 OCR + 接收目标推进]
    State --> Preview[改 A 区: 底部按钮栏 + 左侧提示 + 轻量热区]
    Preview --> Edit[改 B 区提示: 跟随 OCR 状态]
    Edit --> Verify[验证阶段: 测试 / 构建 / Python 语法]
    Verify --> Archive[归档: /opsx:archive]
```

## 当前进度

- [x] 研究代码与用户纠正
- [x] /opsx:propose
- [x] /opsx:apply
- [x] 更新文档与 lessons
- [x] 失败测试
- [x] 状态层修正
- [x] A 区底部按钮栏、左侧提示与轻量热区
- [x] B 区提示修正
- [x] 测试和构建验证
- [x] /opsx:archive

## 2026-03-21 A区预览自适应修复

```mermaid
graph TD
    Start2[开始] --> Reproduce2[复现 A 区预览问题]
    Reproduce2 --> Diagnose2[确认小图不会放大到卡片]
    Diagnose2 --> Propose2[OpenSpec Propose: A 区预览自适应]
    Propose2 --> Apply2[OpenSpec Apply]
    Apply2 --> Docs2[更新 task_plan / findings / progress / FLOW]
    Docs2 --> RedTest2[先补失败测试: 小图预览贴合卡片]
    RedTest2 --> Fix2[实现预览框自适应放大/缩小]
    Fix2 --> Verify2[验证阶段: 单测 + 浏览器复测]
    Verify2 --> Archive2[归档: /opsx:archive]
```

## 这轮进度

- [x] 复现问题
- [x] 根因定位
- [x] /opsx:propose
- [x] /opsx:apply
- [x] 更新文档
- [x] 失败测试
- [x] 实现预览修复
- [x] 测试和浏览器验证
- [x] /opsx:archive

## 2026-03-21 B区默认替换规则显示10条

```mermaid
graph TD
    Start3[开始] --> Diagnose3[定位默认规则条数来源]
    Diagnose3 --> Propose3[OpenSpec Propose: B 区默认 10 条规则]
    Propose3 --> Confirm3[等待用户确认]
    Confirm3 --> Apply3[OpenSpec Apply]
    Apply3 --> Docs3[更新 task_plan / findings / progress / FLOW]
    Docs3 --> RedTest3[先补失败测试: 新图和重置后都应有10条]
    RedTest3 --> Fix3[实现默认规则工厂和重置逻辑]
    Fix3 --> Verify3[验证阶段: 定向测试 / 全量测试 / 构建]
    Verify3 --> Archive3[归档: /opsx:archive]
```

## 这轮进度

- [x] 根因定位
- [x] /opsx:propose
- [x] 等待确认
- [x] /opsx:apply
- [x] 更新文档
- [x] 失败测试
- [x] 实现默认 10 条规则
- [x] 测试和构建验证
- [x] /opsx:archive

## 2026-03-21 A/B/C 底部按钮栏彻底统一

```mermaid
graph TD
    Start4[开始] --> Check4[看用户红框与真实运行态]
    Check4 --> Propose4[OpenSpec Propose: A/B/C 底部栏彻底统一]
    Propose4 --> Apply4[OpenSpec Apply]
    Apply4 --> RedTest4[先补更严测试: 禁止 A 区专用底部类 + 统一 panel-body 约束]
    RedTest4 --> Shared4[抽共享底部栏样式与按钮尺寸常量]
    Shared4 --> Verify4[全量测试 / 构建 / Python 检查 / 浏览器截图]
    Verify4 --> Archive4[归档: /opsx:archive]
```

## 这轮进度

- [x] 看用户红框与真实运行态
- [x] /opsx:propose
- [x] /opsx:apply
- [x] 先补更严测试
- [x] 抽共享底部栏样式与按钮尺寸常量
- [x] 全量测试 / 构建 / Python 检查 / 浏览器截图
- [x] /opsx:archive

## 2026-03-21 修 review 发现的 3 个问题

```mermaid
graph TD
    Start5[开始] --> Review5[读取 review 结论与浏览器证据]
    Review5 --> Propose5[OpenSpec Propose: 修 3 个已坐实问题]
    Propose5 --> Apply5[OpenSpec Apply]
    Apply5 --> Docs5[更新 task_plan / findings / progress / FLOW]
    Docs5 --> RedTest5[先补失败测试: 状态只改勾选项 / 坏图页面报错 / OCR 文案一致]
    RedTest5 --> FixState5[改批处理状态链路]
    FixState5 --> FixUpload5[改坏图上传错误提示链路]
    FixUpload5 --> FixReadme5[改 README OCR 步骤]
    FixReadme5 --> Verify5[跑测试 / 构建 / 浏览器复测]
    Verify5 --> Archive5[归档: /opsx:archive]
```

## 这轮进度

- [x] 读取 review 结论与浏览器证据
- [x] /opsx:propose
- [x] /opsx:apply
- [x] 更新 task_plan / findings / progress / FLOW
- [x] 先补失败测试
- [x] 改批处理状态链路
- [x] 改坏图上传错误提示链路
- [x] 改 README OCR 步骤
- [x] 跑测试 / 构建 / 浏览器复测
- [x] /opsx:archive

## 2026-03-21 修 review 发现的另外 5 个问题

```mermaid
graph TD
    Start6[开始] --> Review6[读取新一轮 review 结论]
    Review6 --> Propose6[OpenSpec Propose: 修 5 个已坐实问题]
    Propose6 --> Apply6[OpenSpec Apply]
    Apply6 --> RedTest6[先补失败测试: 6 张上限 / input 清空 / 状态点分色]
    RedTest6 --> FixUpload6[收口上传上限与重传入口]
    FixUpload6 --> FixThumb6[修缩略图状态点分色]
    FixThumb6 --> FixReadme6[改 README 勾选步骤与静态部署说明]
    FixReadme6 --> Verify6[跑定向测试 / 全量测试 / 构建 / Python 检查]
    Verify6 --> Archive6[归档: /opsx:archive]
```

## 这轮进度

- [x] 读取新一轮 review 结论
- [x] /opsx:propose
- [x] /opsx:apply
- [x] 先补失败测试
- [x] 收口上传上限与重传入口
- [x] 修缩略图状态点分色
- [x] 改 README 勾选步骤与静态部署说明
- [x] 跑定向测试 / 全量测试 / 构建 / Python 检查
- [x] /opsx:archive

## 2026-03-21 修仓库整理与可访问性问题

```mermaid
graph TD
    Start7[开始] --> Review7[读取剩下的配置 / 文档 / 可访问性问题]
    Review7 --> Docs7[更新 task_plan / findings / progress / lessons]
    Docs7 --> RedTest7[先补可访问性测试: 缩略图切换必须是按钮]
    RedTest7 --> A11y7[改 EditPanel: 前/后切换变成按钮]
    A11y7 --> Config7[改 tsconfig: 测试类型移出 app 配置]
    Config7 --> Vite7[收口 Vite 配置产物，保留单一源码]
    Vite7 --> Readme7[改 README: SDK 名称对齐 package.json]
    Readme7 --> Verify7[跑测试 / 构建 / 类型检查 / git 状态核对]
    Verify7 --> Archive7[归档: /opsx:archive]
```

## 这轮进度

- [x] 读取剩下的配置 / 文档 / 可访问性问题
- [x] 更新 task_plan / findings / progress / lessons
- [x] 先补可访问性测试
- [x] 改 EditPanel：前/后切换变成按钮
- [x] 改 tsconfig：测试类型移出 app 配置
- [x] 收口 Vite 配置产物，保留单一源码
- [x] 改 README：SDK 名称对齐 package.json
- [x] 跑测试 / 构建 / 类型检查 / git 状态核对
- [x] 归档: /opsx:archive
