# Notify - 聚合通知管理应用

## 项目简介

Notify 是一个现代化的聚合通知管理平台，支持多渠道通知分发、定时任务调度和 AI 智能辅助配置，让你轻松管理各类通知渠道和推送规则。

## 启动指南

### 1. 后端服务

```bash
cd backend
npm install
npm run dev
```

后端服务运行在 `http://localhost:3000`。首次启动时，控制台会输出系统 Token，用于前端登录认证。

### 2. 前端应用

```bash
cd frontend
npm install
npm run dev
```

前端应用运行在 `http://localhost:5173`。

## 功能特性

### 通知管理

- **多种触发类型**：支持单次触发（once）、循环触发（recurring）、Webhook 触发
- **Cron 定时调度**：使用标准 Cron 表达式配置周期性通知任务
- **多渠道绑定**：一个通知可同时绑定多个渠道
- **状态管理**：启用/停用控制，支持按状态、触发类型筛选
- **下次触发预览**：自动计算并显示下次触发时间

### 渠道管理

支持的渠道类型：

| 渠道 | 说明 |
|------|------|
| Bark | iOS 推送通知 |
| PushPlus | 支持 ServerChan、PushDeer |
| 企业微信 Webhook | 企业微信群机器人 |
| 钉钉 Webhook | 钉钉群机器人 |
| 飞书 Webhook | 飞书群机器人 |
| 通用 Webhook | 支持 Telegram、Discord、Slack 等 |

渠道功能：

- Token 加密存储
- 可配置重试次数
- 启用/停用状态管理
- 最后使用时间追踪
- 关联通知数量统计

### 推送记录

- 完整的推送历史记录
- 推送结果追踪（成功/部分成功/失败）
- 每个渠道的独立推送结果
- 错误详情和错误摘要
- Webhook 请求日志（来源 IP、请求体）

### 概览仪表盘

- 通知和渠道统计概览
- 7 日推送趋势
- 最近推送记录
- 快捷操作入口

### AI 智能配置

- 自然语言创建通知
- AI 主动询问缺失参数
- 完整的对话历史
- 自动创建通知并关联

### 设置中心

- AI 服务配置（Base URL、API Key、模型选择）
- 定时调度时间偏好设置
- 高频调度开关（默认关闭，防止误操作）
- 用户头像管理

## 技术栈

- **后端**：NestJS + Prisma + SQLite
- **前端**：React + TanStack Query + React Router
- **样式**：CSS Variables + 玻璃态设计

## 认证方式

系统使用 Token 认证。请在后端启动日志中查找自动生成的 Token 进行登录。
