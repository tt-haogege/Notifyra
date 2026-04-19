# AI 一句话新建通知 — 功能与迭代记录

本文档汇总「自然语言一句话创建通知」相关的前后端实现、交互约定，以及迭代过程中修复的问题与样式决策，便于后续维护与排查。

---

## 1. 功能概述

- **入口**：通知列表页「AI 一句话新建」按钮；新建通知表单页顶部横幅「打开 AI 对话」（及 AI 预填成功提示）。
- **交互**：弹窗 `AiQuickCreateModal` 内多轮对话；AI 收集字段并输出 `[READY]` + `[PARAMS]{...}[/PARAMS]`；就绪后展示摘要，支持「直接创建」或「去编辑页调整」。
- **后端**：`AiSessionsService` 驱动会话、`AiChatService` 调用兼容 OpenAI 的 API；参数解析与触发配置二次校验。

---

## 2. 后端实现要点

### 2.1 System Prompt

- `buildSystemPrompt(channels)` 动态注入用户**当前可用渠道**（id / 名称），便于模型准确填写 `channelIds`。
- 约定模型在 `[PARAMS]...[/PARAMS]` 内输出合法 JSON；自然语言说明写在标记之前。

### 2.2 参数解析与就绪状态

- `[PARAMS]` 正则需支持闭合标签 `/[/PARAMS]`，避免解析失败。
- `[READY]` 与 JSON 解析成功后将会话置为 `ready_to_create`；同时用 `NotificationTriggerService.validateConfig` 对 `triggerConfig` 做二次校验；失败则退回继续对话并附加提示。

### 2.3 会话消息持久化（修复 invalid chat setting 2013）

- **读**：从历史 `messagesJson` 中仅保留 `user` / `assistant`，丢弃误存的 `system`。
- **写**：仅持久化 `user`/`assistant`，**不**把 system prompt 写入数据库；每次请求系统提示由 `buildSystemPrompt` 动态拼接。
- **返回前端**：`formatSession` 同样过滤非 user/assistant，并保证 `timestamp` 一致。

### 2.4 模块依赖

- `NotificationsModule` 导出 `NotificationTriggerService`；`AiModule` `imports` `NotificationsModule` 以便注入校验。

**相关文件**：`backend/src/ai/ai-sessions.service.ts`、`backend/src/ai/ai.module.ts`、`backend/src/notifications/notifications.module.ts`。

---

## 3. 前端实现要点

### 3.1 组件结构

- **外层 / 内层**：`AiQuickCreateModal` 仅在 `open` 时挂载 `AiQuickCreateModalInner`，关闭即卸载，避免「关闭后重置状态」触发的 `setState-in-effect` 问题。

### 3.2 业务流

- 打开弹窗创建 AI 会话；对话成功后更新 `collectedParams`；`isReady` 时展示摘要列表 `SummaryList`（渠道名通过 channels 查询映射）。
- **直接创建**：`buildCreatePayload` 校验必填后调用 `notificationsApi.create`，成功后 `aiApi.linkNotification` 并跳转 `/notifications/:id`。
- **表单预填**：`NotificationFormPage` 读取 `?ai_session=`，拉取会话并预填草稿（sourceKey 派生 draft 模式，避免 effect 内 setState）。

### 3.3 AI 气泡展示（Markdown + 打字机）

- **依赖**：`react-markdown`、`remark-gfm`。
- **`cleanAiContent(raw)`**：面向用户文本的清洗逻辑  
  - 移除成对 `<think>...</think>`；移除孤立 `<think>` / `</think>`。  
  - **禁止**使用「`<think>[\s\S]*$` 吞到结尾」——会把 `</think>` 之后的正文整块删掉，导致气泡空白。  
  - 移除 `[PARAMS]...[/PARAMS]`、未闭合的 `[PARAMS]...` 至结尾、`[READY]`。  
- **打字机**：仅对**最后一条 assistant** 消息按字符（含步长加速）递增显示；历史消息整段展示；末尾闪烁光标动画 `ai-caret-blink`（见全局 CSS）。
- **样式**：助手气泡 `whiteSpace: normal` 交给 Markdown；用户气泡仍 `pre-wrap`。

### 3.4 「信息已收集完整」摘要卡片

- **不用**全局类 `preview-box success` 单独承载整块摘要：`.preview-box` 自带 `min-height` / `pre-wrap`，易与摘要列表布局冲突。
- 使用内联浅色绿底 + 绿色描边的容器包裹**标题行 + SummaryList 全文**。
- **Flex 陷阱**：摘要与消息列表同处于 `flex-direction: column` + `overflow-y: auto` 的滚动父级时，子项默认 `flex-shrink: 1`，会被压扁，导致内部 `<dl>` 视觉上「溢出」到卡片外（只剩一条绿条）。  
  **处理**：消息列表外层容器与摘要卡片均设置 `flex-shrink: 0`，由父级滚动承载超长内容。

### 3.5 弹窗高度

- Modal 主体 `max-height: 82vh`、`overflow: hidden`；中间滚动区 `flex: 1 1 auto`、`min-height: 240`，避免空会话时对话区高度塌成 0。
- 消息区与摘要在同一滚动容器内，底部操作栏 `flex-shrink: 0` 固定。

### 3.6 图标（非 Emoji）

- 统一 SVG：`SparklesIcon`、`CheckCircleIcon`、`CheckIcon`、`CloseIcon`（`frontend/src/components/common/icons.tsx`）。
- 列表入口、表单横幅、弹窗标题/关闭/创建按钮等处替换原 Emoji。

### 3.7 FakeSwitch 宽度

- `.fake-switch`（含 `legacy.css` 与 `index.css` 中与开关重复的定义）增加：`flex: 0 0 46px`、`box-sizing: border-box`、`padding: 0`、`border: none`，避免在 flex 行内被挤成只剩圆形 thumb。

### 3.8 全局样式补充

- `@keyframes ai-caret-blink`；`.ai-md > :first-child / :last-child` 收紧 Markdown 首尾边距。

**相关文件**：  
`frontend/src/components/ai/AiQuickCreateModal.tsx`、`frontend/src/pages/NotificationsListPage.tsx`、`frontend/src/pages/NotificationFormPage.tsx`、`frontend/src/components/common/icons.tsx`、`frontend/src/components/common/FakeSwitch.tsx`、`frontend/src/styles/legacy.css`、`frontend/src/index.css`。

---

## 4. API 与类型（简述）

- AI：`aiApi.createSession`、`chat`、`linkNotification`；会话详情用于预填。
- 通知创建：`CreateNotificationDto` 与现有 `notificationsApi.create` 一致。

---

## 5. 已知权衡

- Markdown 依赖使主包体积增大；若需优化可后续对 `react-markdown` 做路由级或弹窗级懒加载。
- 打字机与 Markdown 组合：展示片段在打字过程中可能出现未闭合加粗等瞬时形态，属可接受权衡。

---

## 6. 回归检查建议

- 连续多轮 AI 对话不报 `invalid chat setting (2013)`。
- 就绪后摘要五条字段均在绿色卡片背景内，窗口缩小时中间区域可滚动、底部按钮不被遮挡。
- 模型返回含 `<think>` / `[PARAMS]` 时，气泡仍能显示正文或合理隐藏空气泡（仅控制符时）。
- 列表页开关在窄列宽下仍为完整跑道形而非单圆点。

---

## 7. 文档范围说明（是否「本会话全部修改」）

**本文件刻意聚焦**：AI 一句话新建通知（会话、解析、弹窗、摘要、直接创建、表单预填、相关样式与依赖）。

**同属 AI 迭代但上文未逐条展开的补充点**（代码里已有）：

- 清洗后正文为空时，该条 assistant 气泡 **不渲染**（`return null`），避免出现「只剩光标」的假象。
- 欢迎语 `WELCOME_TEXT` 改为 Markdown 友好格式（段落 + 列表），避免单换行在 Markdown 中被忽略。
- 渠道列表查询在摘要展示时启用（`useQuery` 与 `isReady` 联动），用于 `SummaryList` 展示渠道名称。

**工程化 / 脚手架级改动**（保障构建通过，不一定归入产品功能叙述）：

- `frontend/src/api/client.ts`：`verbatimModuleSyntax` 下对 `AxiosRequestConfig` 使用 **type-only import**。
- 本地执行过 `npx prisma generate` 以消除 Prisma Client 类型不同步（属环境/生成步骤，非业务逻辑变更）。

**若同一会话中还包含与 AI 无关的需求**（例如通知详情 Webhook Token 展示、列表操作按钮样式替换等），**不在本文件追踪**；建议在对应页面/模块旁注释或单独「变更记录」文档维护，以免与本特性混读。

---

## 8. 相关文件清单（便于检索）

| 层级 | 路径 |
|------|------|
| 后端会话与聊天 | `backend/src/ai/ai-sessions.service.ts` |
| 后端 AI 控制器 | `backend/src/ai/ai-sessions.controller.ts` |
| 模块装配 | `backend/src/ai/ai.module.ts`、`backend/src/notifications/notifications.module.ts` |
| 前端弹窗 | `frontend/src/components/ai/AiQuickCreateModal.tsx` |
| 前端页面 | `frontend/src/pages/NotificationsListPage.tsx`、`frontend/src/pages/NotificationFormPage.tsx` |
| API | `frontend/src/api/ai.ts`、`frontend/src/api/notifications.ts`（沿用创建接口） |
| 客户端 | `frontend/src/api/client.ts`（类型导入） |
| 图标 | `frontend/src/components/common/icons.tsx` |
| 开关 | `frontend/src/components/common/FakeSwitch.tsx` |
| 样式 | `frontend/src/styles/legacy.css`、`frontend/src/index.css` |
| 依赖声明 | `frontend/package.json`（含 `react-markdown`、`remark-gfm`） |
