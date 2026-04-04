# Notifyra 新对话 / 新模型接手指南

## 1. 目的

本指南用于帮助在以下场景下快速恢复工作：
- 对话中断后继续
- 切换模型后继续
- 新会话重新接手当前仓库
- 多次开发后重新进入项目

---

## 2. 接手时必须先确认的事项

### 2.1 当前目标是什么
优先确认当前正在做的是：
- 哪一个阶段
- 哪一个任务编号
- 当前任务的边界是什么
- 当前任务是否已有计划文档

主要参考：
- `design/DevelopmentPlan.md`
- `design/dev/ExecutionChecklist.md`
- 当前最新计划文件或专项设计文档

### 2.2 当前技术基线是什么
当前项目已确认的关键基线：
- 后端：NestJS + TypeScript
- ORM：Prisma
- 数据库：SQLite
- 数据目录：`/data/app.db`
- 调度：`node-schedule`
- 响应格式：`{ code, data, message }`

### 2.3 当前代码风格要求是什么
必须遵守：
- 分号
- 缩进与格式统一
- 尽量少用不必要的 `else`
- 优先使用 guard clause

---

## 3. 接手后的标准动作

### 第一步：读设计与流程文档
必须按顺序阅读：
1. `design/RequirementDesign.md`
2. `design/ProductDesign.md`
3. `design/TechnicalDesign.md`
4. `design/DevelopmentPlan.md`
5. `design/dev/README.md`
6. `design/dev/DevelopmentWorkflow.md`
7. 当前任务相关专项文档

### 第二步：确认代码现状
至少确认：
- 当前已实现到哪个阶段
- 已有哪些测试通过
- 哪些模块已经落地
- 哪些目录是占位、哪些已经有正式实现

### 第三步：确认本次任务边界
要回答清楚：
- 本次只做什么
- 本次明确不做什么
- 是否要先出计划
- 是否需要 TDD
- 是否需要 e2e

### 第四步：再开始开发
没有完成以上步骤前，不要直接动代码。

---

## 4. 接手时优先复用的实现模式

### 4.1 backend
优先复用：
- `module / controller / service / dto` 分层
- `JwtAuthGuard + CurrentUser`
- `PrismaService` 全局注入
- mocked PrismaService 的 e2e 测试模式
- 全局异常过滤器与响应拦截器

### 4.2 frontend
优先复用：
- 当前设计稿和已实现原型中的布局逻辑
- 已有主题体系
- 已有玻璃态与暗黑适配模式

---

## 5. 接手时要避免的错误

不要：
- 不看设计文档就直接开发
- 把当前阶段做成后续阶段的大杂烩
- 顺手大范围重构无关代码
- 自作主张改接口口径
- 忽略统一响应格式
- 跳过 TDD 红灯验证
- 为简单任务做过多 review 往返

---

## 6. 接手完成的判断标准

可以开始实际开发，至少说明以下内容已经明确：
- 当前任务编号
- 当前任务边界
- 关键文件路径
- 需要复用的已有实现
- 需要补的测试层级
- 最后要跑哪些验证命令
