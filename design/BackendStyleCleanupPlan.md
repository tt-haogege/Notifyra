# Backend Style Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the existing `backend/` TypeScript code style without changing business behavior.

**Architecture:** Keep the current NestJS module structure and only normalize source formatting/style. The cleanup is intentionally narrow: add semicolons consistently, align formatting/indentation, and flatten obviously unnecessary `else`-style branching with guard clauses where behavior stays identical.

**Tech Stack:** NestJS, TypeScript, Jest, Supertest, Prisma 7.x, Prettier, ESLint.

---

## File Map

**Modify:**
- `backend/src/app.controller.spec.ts`
- `backend/src/app.controller.ts`
- `backend/src/app.module.ts`
- `backend/src/app.service.ts`
- `backend/src/auth/auth.controller.ts`
- `backend/src/auth/auth.module.ts`
- `backend/src/auth/auth.service.spec.ts`
- `backend/src/auth/auth.service.ts`
- `backend/src/auth/current-user.decorator.ts`
- `backend/src/auth/dto/login.dto.ts`
- `backend/src/auth/dto/register.dto.ts`
- `backend/src/auth/jwt-auth.guard.ts`
- `backend/src/auth/jwt.strategy.ts`
- `backend/src/main.ts`
- `backend/src/shared/all-exceptions.filter.ts`
- `backend/src/shared/prisma/prisma.module.ts`
- `backend/src/shared/prisma/prisma.service.ts`
- `backend/src/shared/response.interceptor.ts`
- `backend/test/auth.e2e-spec.ts`

**Verification commands:**
- `npm test`
- `npm run test:e2e`
- `npm run build`

### Task 1: Normalize backend source style

**Files:**
- Modify: `backend/src/**/*.ts`
- Modify: `backend/test/auth.e2e-spec.ts`

- [ ] **Step 1: Snapshot the current backend diff**

Run:
```bash
git -C /Users/zhouhao/Desktop/web/notify/.claude/worktrees/clickable-prototype diff -- backend
```
Expected: current backend changes are shown so the cleanup stays scoped to style-only edits.

- [ ] **Step 2: Apply style-only edits across backend TypeScript files**

Rules to apply in every touched file:
```ts
// Use semicolons consistently.
import { Injectable } from '@nestjs/common';

// Keep formatting compact and consistent.
const token = this.jwtService.sign({ sub: user.id, username: user.username });

// Prefer guard clauses over unnecessary else nesting.
if (!user) throw new UnauthorizedException('用户名或密码错误');

const passwordMatch = await bcrypt.compare(password, user.password);
if (!passwordMatch) throw new UnauthorizedException('用户名或密码错误');

return { token, username: user.username };
```
Expected edits:
- add semicolons consistently
- preserve current logic and API behavior
- avoid structural refactors unless needed only to remove trivial nesting
- keep imports/order readable, but do not introduce unrelated code movement

- [ ] **Step 3: Run formatting check via existing formatter command**

Run:
```bash
npm run format
```
Expected: Prettier rewrites `src/**/*.ts` and `test/**/*.ts` into a consistent baseline without errors.

- [ ] **Step 4: Manually inspect style-sensitive files after formatting**

Review these files specifically because they contain current logic branches and recent edits:
```text
backend/src/auth/auth.service.ts
backend/src/shared/prisma/prisma.service.ts
backend/src/main.ts
backend/test/auth.e2e-spec.ts
```
Expected: semicolons are present, formatting is consistent, and no accidental behavior changes were introduced.

### Task 2: Verify behavior did not change

**Files:**
- Verify: `backend/src/**/*.ts`
- Verify: `backend/test/auth.e2e-spec.ts`

- [ ] **Step 1: Run unit tests**

Run:
```bash
npm test
```
Expected:
```text
Test Suites: 2 passed, 2 total
Tests:       9 passed, 9 total
```

- [ ] **Step 2: Run e2e tests**

Run:
```bash
npm run test:e2e
```
Expected:
```text
Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
```
Note: `AllExceptionsFilter` error logs during negative-path assertions are acceptable as long as the suite passes.

- [ ] **Step 3: Run production build**

Run:
```bash
npm run build
```
Expected:
```text
> backend@0.0.1 build
> nest build
```
with exit code `0` and no TypeScript errors.

- [ ] **Step 4: Review final backend diff for scope**

Run:
```bash
git -C /Users/zhouhao/Desktop/web/notify/.claude/worktrees/clickable-prototype diff -- backend
```
Expected: diff is limited to semicolons, formatting, and minimal guard-clause style cleanup; no business logic or API contract changes.

- [ ] **Step 5: Commit**

Run:
```bash
git -C /Users/zhouhao/Desktop/web/notify/.claude/worktrees/clickable-prototype add backend/src backend/test/auth.e2e-spec.ts
git -C /Users/zhouhao/Desktop/web/notify/.claude/worktrees/clickable-prototype commit -m "$(cat <<'EOF'
style: unify backend code style
EOF
)"
```
Expected: one style-only commit is created after tests and build pass.
