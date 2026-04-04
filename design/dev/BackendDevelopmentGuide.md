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

---

## 6. backend 常见风险点

开发时重点注意：
- 用户隔离漏掉 `userId`
- 返回体不符合统一格式
- DTO 校验缺失
- 把 token/hash 明文逻辑写错
- 把后续阶段逻辑提前混进当前任务
- e2e 里误依赖真实数据库

---

## 7. backend 完成标准

至少要满足：
- 相关 unit tests 通过
- 相关 e2e 通过
- build 通过
- 行为符合设计文档
- 没有破坏当前模块既有接口约定
