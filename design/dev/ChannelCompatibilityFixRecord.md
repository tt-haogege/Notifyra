# 渠道兼容修复记录（2026-04-04）

## 1. 背景

本次修复针对“渠道测试发送报 `暂不支持该渠道类型`”的问题。

问题根因不是渠道 driver 缺失，而是历史数据 / 前端旧值传入后端时，`type` 与 `config` 没有在进入发送链路前完成统一归一化，导致 `ChannelDriverRegistry` 无法命中对应 driver。

---

## 2. 根因分析

### 2.1 渠道 type 不一致

前端和部分历史数据仍使用旧类型值，例如：
- `Feishu`
- `WeCom`
- `DingTalk`
- `Bark`
- `ServerChan`
- `PushDeer`

而后端 driver registry 实际只识别内部类型：
- `feishu_webhook`
- `wecom_webhook`
- `dingtalk_webhook`
- `bark`
- `generic_webhook`
- `pushplus`

如果发送链路直接拿旧值调用 driver registry，就会抛出“暂不支持该渠道类型”。

### 2.2 渠道 config key 不一致

前端表单和部分历史配置使用的 key 与 driver 期望值不一致，例如：
- `webhookUrl` → `webhook`
- `url` → `serverUrl`

如果 config 未归一化，driver 即使命中，也可能读不到正确配置。

---

## 3. 实现方案

本次修复统一复用 `backend/src/channels/channel-normalizer.ts`，不额外新增重复工具。

### 3.1 新增 / 收敛的归一化能力

在 `channel-normalizer.ts` 中集中维护：
- 历史渠道类型到后端内部类型的映射
- 前端旧配置 key 到 driver 期望 key 的映射
- 配置序列化 / 反序列化时的统一归一化入口

关键能力包括：
- `normalizeChannelType(type)`
- `normalizeChannelConfig(type, config)`
- `serializeChannelConfig(type, config)`
- `parseChannelConfig(type, configJson)`

### 3.2 ChannelsService 落地位置

在 `backend/src/channels/channels.service.ts` 中，归一化逻辑落在以下路径：
- 创建渠道时：归一化 `type`，并统一序列化 `config`
- 列表筛选时：归一化查询参数 `type`
- 详情读取时：归一化 `configJson`
- 更新渠道时：按已有渠道类型统一归一化新配置

目标是保证：
- 新创建数据按内部类型落库
- 查询条件兼容前端旧值
- 历史数据读取后返回统一配置结构

### 3.3 SendChannelService 落地位置

在 `backend/src/channels/send-channel.service.ts` 中，发送前统一执行：
1. `parseChannelConfig(channel.type, channel.configJson)`
2. `normalizeChannelType(channel.type)`
3. 用归一化后的 `type` 调用 `driverRegistry.getDriver(...)`
4. 用归一化后的 `config` 调用 `driver.send(...)`

该策略同时覆盖：
- 用户在后台手动测试发送
- 通过开放 token 调用发送

---

## 4. 影响范围

按 GitNexus impact 分析：

### 4.1 ChannelsService
- 风险级别：LOW
- d=1 直接影响：
  - `backend/src/channels/channels.controller.ts`
  - `backend/src/channels/channels.module.ts`
  - `backend/src/channels/channels.service.spec.ts`
  - `backend/src/channels/channels.controller.spec.ts`

### 4.2 SendChannelService
- 风险级别：MEDIUM
- d=1 直接影响：
  - `backend/src/channels/open-channel.controller.ts`
  - `backend/src/test-module/test-channel.controller.ts`
  - `backend/src/channels/send-channel.service.spec.ts`
  - `backend/src/test-module/test-channel.controller.spec.ts`
  - `backend/src/channels/channels.module.ts`

本次未出现 HIGH / CRITICAL 风险，可以继续按既定范围收敛修改。

---

## 5. 测试与验证记录

### 5.1 本次补充 / 对齐的验证重点

重点验证以下行为：
- 非当前用户渠道仍返回不存在
- 已停用渠道不可测试发送
- 非法 `configJson` 会被拒绝
- 正常类型和配置可命中对应 driver
- 历史 type + 历史 config key 会在发送前被正确归一化
- 发送成功时会更新 `lastUsedAt`
- 发送失败时返回标准失败结果且不更新 `lastUsedAt`

### 5.2 已补的关键回归用例

在 `backend/src/channels/send-channel.service.spec.ts` 中补充关键场景：
- `type = 'Feishu'`
- `configJson = '{"webhookUrl":"https://example.com"}'`

期望：
- registry 收到 `feishu_webhook`
- driver 收到 `config: { webhook: 'https://example.com' }`

该用例用于直接防止“测试发送报暂不支持该渠道类型”的回归。

### 5.3 已识别的测试不一致点

`backend/src/channels/channels.service.spec.ts` 中仍存在旧预期残留：
- 一部分断言已经期望内部类型归一化为 `feishu_webhook`
- 另一部分断言仍保留旧值 `feishu`

后续如果继续收口测试，需要统一服务层对外返回值与测试预期，避免同一条链路同时保留两套类型语义。

---

## 6. 本次开发结论

本次修复的核心不是新增 driver，而是把渠道兼容逻辑收敛到服务层入口，统一处理：
- 历史渠道 type
- 前端旧 type
- 历史 config key
- 前端表单旧 config key

这样可以保证：
- 新数据落库更稳定
- 旧数据可继续使用
- 测试发送与开放发送链路都能命中正确 driver

---

## 7. 后续建议

后续相关任务建议继续按以下顺序推进：
1. 收敛前端渠道类型枚举与表单字段
2. 统一后端接口返回中的渠道类型语义
3. 跑相关 unit / e2e / build 验证
4. 提交前执行 GitNexus `detect_changes()`，确认影响范围符合预期
