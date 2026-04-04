# 渠道兼容修复记录（2026-04-04）

## 1. 背景

本次修复针对渠道测试发送链路中的兼容问题：
- 从渠道详情页进入测试页后，调用 `/test/channel/:id/send`
- 后端返回“暂不支持该渠道类型”

根因不是 token 本身，而是两类历史兼容问题同时存在：
1. 数据中的渠道 `type` 与后端 driver registry 使用的 canonical type 不一致
2. 渠道 `configJson` 中的字段 key 与各 driver 实际要求的 key 不一致

如果只修 `type`，发送链路仍可能因为 `config` key 不匹配而在 driver 层失败，因此这次修复按“类型 + 配置字段”一起收敛。

---

## 2. 修复目标

本次开发的目标有四个：
- 兼容历史渠道数据，避免老数据无法发送测试
- 新建/编辑渠道时统一写入 canonical type 与 canonical config key
- 前端只使用后端已支持的渠道类型集合
- 前端列表、详情、通知关联展示统一使用同一套渠道类型文案

---

## 3. 后端处理策略

### 3.1 引入统一归一化入口

后端以 `backend/src/channels/channel-normalizer.ts` 作为渠道兼容入口，负责：
- 旧渠道类型映射到 canonical type
- 旧配置 key 映射到 driver 可识别的配置结构
- `configJson` 的解析与标准化输出

canonical channel type 收敛为：
- `wecom_webhook`
- `feishu_webhook`
- `dingtalk_webhook`
- `bark`
- `generic_webhook`
- `pushplus`

### 3.2 在服务层统一接入

本次兼容逻辑落在两个核心服务入口：

#### `backend/src/channels/channels.service.ts`
负责：
- `create()`：入库前标准化 type 和 config
- `list()`：查询前标准化筛选 type
- `getDetail()`：详情返回前标准化 config
- `update()`：编辑保存时把旧 key 收敛为新 key

#### `backend/src/channels/send-channel.service.ts`
负责：
- `send()`：测试发送前标准化渠道类型与配置
- `sendByToken()`：开放发送链路同样标准化

这样可以同时覆盖：
- 新创建的数据
- 历史数据库中的旧数据
- 测试发送链路
- token 发送链路

---

## 4. 前端收敛策略

### 4.1 类型与文案统一

前端渠道展示与筛选统一收敛到共享常量：
- `frontend/src/constants/channelTypes.ts`

该文件统一维护：
- canonical type 到中文名称的映射
- 渠道下拉选项

### 4.2 表单配置字段与后端对齐

前端渠道表单收敛到后端已支持的 driver 类型，并直接使用 driver 的真实配置字段：
- webhook 类渠道统一使用 `webhook`
- Bark 使用 `serverUrl`
- PushPlus 使用 `token`

涉及的主要文件：
- `frontend/src/api/channels.ts`
- `frontend/src/pages/ChannelFormPage.tsx`

### 4.3 展示页统一使用共享映射

以下页面统一改为复用共享渠道类型映射，避免各页各自维护旧 `typeMap`：
- `frontend/src/pages/ChannelDetailPage.tsx`
- `frontend/src/pages/ChannelsListPage.tsx`
- `frontend/src/pages/TestModulePage.tsx`
- `frontend/src/pages/NotificationsListPage.tsx`
- `frontend/src/pages/NotificationDetailPage.tsx`

---

## 5. 本轮补充修复与收尾

在主兼容方案已经落地后，本轮继续完成了以下收尾：

### 5.1 修复前端类型检查报错

修复了两个页面中使用 `CHANNEL_TYPE_LABELS[ch.type]` 时的 TS7053 错误：
- `frontend/src/pages/NotificationDetailPage.tsx`
- `frontend/src/pages/NotificationsListPage.tsx`

原因是 `ch.type` 被推断为 `string`，不能直接作为 `Record<ChannelType, string>` 的索引。

### 5.2 清理测试残留

补齐并统一了渠道相关单测中的历史 mock 数据，保证测试数据与当前 canonical type 保持一致：
- `backend/src/channels/channels.service.spec.ts`
- `backend/src/channels/send-channel.service.spec.ts`

另外还顺手修正了：
- `frontend/src/pages/ChannelsListPage.tsx` 中一处展示代码缩进残留

---

## 6. 验证结果

### 6.1 后端测试

已通过渠道相关单测：
- `channels.service.spec.ts`
- `send-channel.service.spec.ts`

结果：
- `Test Suites: 2 passed`
- `Tests: 16 passed`

### 6.2 前端类型检查

已重新执行前端 TypeScript 类型检查，结果通过。

### 6.3 影响范围检查

已执行 GitNexus 变更检测：
- `gitnexus_detect_changes(scope: "all")`

结果：
- 风险级别：`medium`
- 影响范围仍在本次渠道兼容与相关展示页内，没有扩散到意外业务链路

---

## 7. 这次修复的关键结论

1. 这类问题不能只看接口报错文本，要优先核对数据层实际存储值是否和运行时 registry/driver 对齐
2. 渠道兼容不能只修类型映射，配置字段结构也必须一起归一化
3. 历史兼容逻辑应集中在服务入口，而不是散落到 controller 或前端页面
4. 前端类型、表单字段、展示文案必须共享同一份定义，否则容易再次产生分叉

---

## 8. 后续回归建议

建议后续手工回归至少覆盖以下路径：

### 渠道链路
- 新建渠道
- 编辑历史渠道
- 渠道详情页进入测试页
- 执行测试发送

### 通知链路
- 通知列表查看渠道标签展示
- 通知详情查看关联渠道展示
- 测试页切换不同渠道类型查看示例代码是否正常

### 开放接口链路
- 使用渠道 token 调用开放发送接口
- 验证历史数据与新数据都能正常命中正确 driver

---

## 9. 本文档用途

本文档用于后续在以下场景快速恢复上下文：
- 新对话续做渠道模块开发
- 继续做手工回归或提测
- 排查渠道发送类回归 bug
- 回顾这次兼容方案为什么必须同时处理 type 与 config key
