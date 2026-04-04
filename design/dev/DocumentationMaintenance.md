# Notifyra 文档维护规范

## 1. 目的

确保设计、开发流程、执行规范发生变化时，文档能够同步更新，避免后续模型或新对话拿到过时流程。

---

## 2. 哪些变更必须更新文档

以下变化出现时，必须同步更新 `design/dev/`：
- 开发流程变更
- review 流程变更
- TDD 执行方式变更
- 测试要求变更
- git / 提交流程变更
- 风格规范变更
- 阶段边界与执行策略发生稳定变化

---

## 3. 更新原则

- 文档更新要和规则变化同步发生
- 不要等到后面集中补
- 规则一旦稳定，就要沉淀到 `design/dev/`
- 如果已有文档能更新，就优先更新，不要重复造文档
- 如果已经确认当前任务需要先补流程/规范文档，应先更新文档，再继续实现工作

---

## 4. 维护顺序

如果规则发生变化，建议按以下顺序检查：
1. `design/dev/README.md`
2. `design/dev/DevelopmentWorkflow.md`
3. 相关专项文档
   - `ReviewChecklist.md`
   - `TestingGuidelines.md`
   - `GitWorkflow.md`
   - `BackendDevelopmentGuide.md`
   - `FrontendDevelopmentGuide.md`
   - `ExecutionChecklist.md`
   - `ProjectOnboarding.md`

---

## 5. 文档目标

本目录文档要服务于以下目标：
- 新模型能快速上手
- 新对话能快速恢复开发上下文
- 不依赖记忆也能理解项目执行方式
- 减少重复解释开发流程的成本
