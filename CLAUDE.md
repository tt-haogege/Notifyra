# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概述

本仓库是 **AI 驱动的开发工作流配置**，包含 Agent、Skill、SOP 模板、规则库和错误记录，用于驱动从需求到代码交付的全流程自动化。

详细的 SOP 流程、Agent 定义和 Skill 说明见 `.ai-coding/CLAUDE.md`。

## AI Coding 工作流

```
/requirement-intake        → R0/R1/R2 判定，产出需求确认文档
/frontend-tech-design      → 前端技术设计文档
/frontend-task-breakdown   → 任务拆解（TASK-xxx 条目）
/frontend-implementation   → 编码 + 单测 + 开发记录
/rule-mining               → 从代码变更中提取 L0/L1/L2 规则
/evaluation-expert         → GAN 对抗测试 → PASS/FAIL 报告
```

每个产出都必须经过评估专家的对抗测试，通过后才能进入下一阶段。

## 核心概念

### R-Level 需求分级

| 等级   | 含义                           | 行动         |
| ------ | ------------------------------ | ------------ |
| **R0** | 业务目标不清晰、核心交互不确定 | 返回设计阶段 |
| **R1** | 主体明确但缺少关键信息         | 请求澄清     |
| **R2** | 满足 4 项以上判定标准          | 可开始实施   |

### L-Level 规则等级

| 等级   | 含义                                |
| ------ | ----------------------------------- |
| **L0** | 公共规则 — 跨项目通用规范（零容忍） |
| **L1** | 项目规则 — 项目级规范               |
| **L2** | 文件规则 — 文件级规范               |

## 目录结构

```
.ai-coding/
├── CLAUDE.md                        # 项目主配置
├── ai-coding-errors.md              # AI 错误记录（铁律，执行前必读）
├── contexts/
│   ├── requirements/                # 需求存储（按业务模块分目录）
│   │   └── 项目功能目录.md          # 项目功能目录概览
│   └── rules/                       # 业务规则库（L0/L1/L2）
├── docs/                            # 辅助文档（蓝图等）
└── sop/
    ├── AI_Coding_SOP.md             # 完整 SOP 文档
    └── templates/                   # 模板文件

.claude/
├── agents/                          # Agent 定义
│   ├── requirement-analyst.md       # 需求解析师
│   ├── frontend-developer.md        # 前端开发工程师
│   ├── backend-architect.md         # 后端工程师（架构+开发）
│   ├── rule-miner.md                # 规则挖掘专家
│   ├── evaluation-expert.md         # 评估专家
│   ├── file-state-manager.md        # 文件状态管理员
│   └── system-requirements-organizer.md  # 系统需求梳理专家
└── skills/                          # Skill 定义
    ├── requirement-intake/          # 需求接入
    ├── frontend-tech-design/        # 前端技术设计
    ├── frontend-task-breakdown/     # 前端任务拆解
    ├── frontend-implementation/     # 前端开发实施
    ├── rule-mining/                 # 规则挖掘
    └── evaluation-expert/           # 评估专家
```

## 铁律

**执行任何操作前，必须先阅读 `.ai-coding/ai-coding-errors.md`**，其中记录了已知的 AI 错误，严禁重犯。

当前错误记录：

- **FP-001**: Vuex action 与 API 函数命名冲突导致递归调用 — 导入 API 函数时必须使用 `as` 别名
- **FP-002**: 文件下载 action 未实现 Blob 下载逻辑 — 必须完整实现 Blob URL 创建到触发下载的全流程

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **notify** (28713 symbols, 34934 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/notify/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/notify/context` | Codebase overview, check index freshness |
| `gitnexus://repo/notify/clusters` | All functional areas |
| `gitnexus://repo/notify/processes` | All execution flows |
| `gitnexus://repo/notify/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
