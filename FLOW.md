# Project Workflow (FLOW.md)

```mermaid
graph TD
    Start[开始] --> Research[研究阶段: 检查仓库状态与远端]
    Research --> Diagnose[定位 Git 未初始化与 mock 数据不可推问题]
    Diagnose --> Propose[OpenSpec Propose: 推送前仓库清理]
    Propose --> Apply[OpenSpec Apply]
    Apply --> RedTest[先补失败测试: 仓库不带内置 mock]
    RedTest --> Cleanup[移除内置 mock 并补 gitignore]
    Cleanup --> Verify[验证阶段: 测试与构建]
    Verify --> GitInit[初始化 Git 并提交]
    GitInit --> Push[绑定远端并推送]
    Push --> Archive[归档: /opsx:archive]
```

## 当前进度
- [x] 研究代码与规范
- [x] 根因定位
- [x] /opsx:propose
- [x] /opsx:apply
- [x] 失败测试
- [x] 移除内置 mock 数据
- [x] 补 gitignore 的 mock/垃圾文件规则
- [x] 测试和构建验证
- [ ] Git 初始化与推送
- [ ] /opsx:archive
