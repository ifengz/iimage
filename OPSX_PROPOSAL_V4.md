# 删除第 1 张和第 3 张 mock 提案 (OPSX_PROPOSAL_V4.md)

## 背景

你要的不是“把标题改一下”，而是把 A 区和 B 区默认 3 张 mock 收窄成只留第 2 张。

现在页面默认 mock 的关键点是：

| 来源 | 现在的表现 |
|------|------------|
| 默认 seed 数据 | 开发环境一打开就自动出现 3 张 mock 图和对应 mock 文案 |
| 用户最新范围 | 第 2 张保留，第 1 张和第 3 张删除 |

## 推荐方案

### 方案一（推荐）

1. 保留第 2 张默认 mock
   - 页面首次打开时，A 区和 B 区还能看到第 2 张
   - 第 2 张原来的假图、假文案、状态都保留

2. 删掉第 1 张和第 3 张默认 mock
   - 页面首次打开后，不再出现第 1 张和第 3 张
   - 列表数量从 3 张变成 1 张

3. 保留真实链路
   - 上传图片
   - 选择图片
   - 编辑规则和说明
   - 保存 prompt
   - 生成结果

### 方案二（不推荐）

把 3 张全删光。这个方案和你刚补充的范围冲突，会误删你明确要求保留的第 2 张。

## 预期改动文件

- [MODIFY] `src/data/mock.ts`
- [MODIFY] `src/hooks/useAssets.ts`
- [MODIFY] `src/components/PreviewPanel.tsx`
- [MODIFY] `src/components/EditPanel.tsx`
- [MODIFY] `src/app.test.tsx`
- [MODIFY] `FLOW.md`
- [MODIFY] `task_plan.md`
- [MODIFY] `progress.md`
- [MODIFY] `findings.md`

## 验证标准

1. 开发环境启动后，只剩第 2 张默认 mock。
2. 第 1 张 `banner_v1_final.png` 和第 3 张 `ad_vertical_promo.png` 不再出现。
3. 上传真实图片后，A/B 区仍能正常进入编辑流程。
4. 没有生成结果时，A 区 after 视图仍然只显示“还没有生成结果”。
5. `npm test -- --run` 和 `npm run build` 通过。

/opsx:propose 需要按这个新范围重记一次。
