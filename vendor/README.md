# 固定的媒体适配包

`newapi-media-client-0.1.0.tgz` 是 AIadapter 的 `media-adapter` 构建包，
不是本仓维护的第二份传输实现。这样克隆 iimage 后不需要相邻的 AIadapter 目录。

- 来源：AIadapter 本地 Git 快照 `8e58ea88be3ad478e3406139e1044273663cca2c` 的 `media-adapter/`。
- 最近修改适配包的提交：`a7849badd9965d2ea45de45dc0c2ab31c16c3365`。
- 从 Git 快照提取源码，用 TypeScript 5.9.3 编译；未修改适配器源码。
- 打包内容只有包描述、README、原仓许可证和 `dist` 下的 JS/类型声明，共 7 个文件。
- SHA-256：`721e7a02e36eb49faf76084c528bb9475a79ac00732437f18393e044c436394e`。
- `pnpm-lock.yaml` 同时锁定包的 SHA-512 完整性。

来源提交是本地 AIadapter 的来源标识，不声称它已发布到上游或 npm。
压缩包内保留来源仓库的 MIT 许可证；此处没有新增授权声明。

升级时在 AIadapter 完成源码测试和构建，再用 `npm pack --ignore-scripts` 生成新包，
同时更新这里的来源/摘要、iimage 依赖和锁文件，并完成独立目录安装、类型检查、
测试和构建。不要直接编辑压缩包内代码，也不要恢复 `file:../AIadapter/...` 依赖。

这只解决依赖可移植性，不代表生产凭证边界或真实网关兼容性已经验收。
