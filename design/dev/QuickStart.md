# Notifyra 快速启动清单

## 1. 目标

给新模型或新对话一个最短路径，在最少时间内知道应该先看什么、先做什么、避免什么。

---

## 2. 五分钟内必须知道的事

- 本项目以设计文档为准，不先看设计不要直接开发
- backend 当前核心栈是 NestJS + Prisma + SQLite
- 数据隔离按 user 维度强约束
- 后端统一响应格式必须是 `{ code, data, message }`
- 默认遵循 TDD
- 简单任务不要被多轮 review 拖长
- 所有开发流程规范都在 `design/dev/`

---

## 3. 最短接手路径

1. 看 `design/dev/README.md`
2. 看 `design/dev/ProjectOnboarding.md`
3. 看 `design/TechnicalDesign.md`
4. 看 `design/DevelopmentPlan.md`
5. 看当前任务相关代码与测试
6. 判断要不要先做计划
7. 再开始开发

---

## 4. 开发时永远要检查的事

- 是否越界做了后续阶段内容
- 是否破坏统一返回格式
- 是否漏了用户隔离
- 是否跳过了红灯确认
- 是否把简单任务做得过长
- 是否需要同步更新 `design/dev/` 文档
