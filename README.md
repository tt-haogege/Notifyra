# Notify - 聚合通知管理应用

## 项目简介
这是一个基于 Node.js 和 React 的聚合通知管理系统，支持多渠道通知分发（飞书、钉钉等）、动态 JS 适配器、Cron 定时任务以及 MCP 协议接入。

## 启动指南

### 1. 后端服务

进入 `backend` 目录并启动服务：

```bash
cd backend
npm install
npm run dev
```

后端服务将运行在 `http://localhost:3000`。
首次启动时，请查看控制台输出或 `backend/src/config.js` 文件，获取生成的系统 `Token`，用于前端登录。

### 2. 前端应用

进入 `frontend` 目录并启动开发服务器：

```bash
cd frontend
npm install
npm run dev
```

前端应用将运行在 `http://localhost:5173`。

## 功能特性

- **多渠道聚合**：内置钉钉、飞书、企业微信、Bark、Pushplus 适配器，支持动态 JS 扩展。
- **定时任务**：支持 Cron 表达式创建周期性通知任务。
- **用户管理**：创建用户并绑定多个通知渠道。
- **勿扰模式**：通知附带“当日不再提醒”链接，点击即生效。
- **安全沙箱**：使用 `vm2` 安全执行用户自定义适配器代码。
- **MCP 接口**：后端已预留 MCP 接口逻辑，可供 AI Agent 调用。

## 默认账户

系统使用 Token 鉴权，请在后端启动日志中查找自动生成的 Token。
