# Notifyra Backend 开发指南

## 1. 当前 backend 基线

- 框架：NestJS
- 语言：TypeScript
- ORM：Prisma
- 数据库：SQLite
- 鉴权：JWT
- 响应格式：`{ code, data, message }`

---

## 2. backend 分层约定

优先使用以下结构：
- `module`
- `controller`
- `service`
- `dto`
- 必要时增加独立子目录，如 `drivers/`

原则：
- controller 保持轻薄
- service 承担业务逻辑
- dto 负责参数校验
- 公共基础设施尽量走 shared

---

## 3. 必须复用的 backend 模式

### 3.1 用户隔离
统一复用：
- `JwtAuthGuard`
- `CurrentUser`

### 3.2 数据访问
统一复用：
- `PrismaService`
- 不要在业务模块自行创建数据库客户端

### 3.3 接口输出
成功与失败都必须遵守：
- 成功：`{ code: 200, data, message: 'ok' }`
- 失败：`{ code, data: null, message }`

### 3.4 异常处理
优先使用 Nest 常见异常：
- `BadRequestException`
- `UnauthorizedException`
- `NotFoundException`
- `ConflictException`

---

## 4. backend 开发顺序建议

### 4.1 新模块
推荐顺序：
1. service 单测
2. service 最小实现
3. controller 接入
4. e2e 测试
5. 全量验证

### 4.2 核心能力扩展
对于通知、渠道、测试、执行层这类核心能力：
- 先确认当前只做哪个阶段
- 严格控制阶段边界
- 不把后续能力提前混入

---

## 5. backend 测试模式

### 5.1 unit test
适合 service 层逻辑：
- `TestingModule`
- `useValue` mock provider
- 只 mock 当前用到的 Prisma 方法

### 5.2 e2e test
推荐模式：
- 启动真实 `AppModule`
- mock `PrismaService`
- 用内存结构模拟数据状态
- 用 supertest 验证 HTTP 链路

注意：这类 mocked PrismaService 的 e2e / 合约测试，主要用于验证接口链路、返回结构与业务分支，不能替代以下验证：
- 真实鉴权 / 权限边界
- 关键输入校验
- 安全异常路径
- 数据库层约束本身

---

## 6. backend 常见风险点

开发时重点注意：
- 用户隔离漏掉 `userId`
- 返回体不符合统一格式
- DTO 校验缺失
- 把 token/hash 明文逻辑写错
- 把后续阶段逻辑提前混进当前任务
- e2e 里误依赖真实数据库
- Prisma schema 已修改但没有同步 regenerate client，导致 TypeScript 类型与 schema 脱节

---

## 7. Prisma 与用户设置类字段变更约定

### 7.1 Prisma schema 变更后的必做项
只要修改了 `backend/prisma/schema.prisma`，就不能只改 schema 文件本身，还必须继续完成：
1. 重新生成 Prisma Client
2. 运行 backend build 或类型检查
3. 补齐受影响模块的单测 / e2e

否则很容易出现：
- `Select` / `UpdateInput` 类型里找不到新字段
- service 已引用新字段，但 Prisma 生成类型还是旧的
- 本地代码看起来已改完，启动或构建时才报错

### 7.2 用户设置开关类需求的落地方式
如果某个行为要从“后端硬编码规则”改成“用户自己的偏好设置”，优先落在 `UserSettings`，并保持以下链路一起变更：
- `schema.prisma`
- settings DTO
- settings service
- 相关业务 service
- 前端 settings API
- 前端 settings 页面
- 相关测试

不要只改业务模块里的判断逻辑，而漏掉设置读写链路。

### 7.3 本项目已落地示例
以 `allowHighFrequencyScheduling` 为例：
- 目标不是全局放开高频 cron
- 默认不做“每 5 分钟一次”的限制
- 只有用户在个人设置里开启“允许高频调度”后，才继续执行这条 5 分钟校验

这类需求本质上是“用户偏好控制业务约束”，应优先按用户设置建模，而不是继续写成全局硬编码。

---

## 8. backend 完成标准

至少要满足：
- 相关 unit tests 通过
- 相关 e2e 通过
- build 通过
- 行为符合设计文档
- 没有破坏当前模块既有接口约定
