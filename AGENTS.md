# AGENTS

<skills_system priority="1">

## 可用 Skills

<!-- SKILLS_TABLE_START -->
<usage>
当用户要求执行任务时，检查下方是否有可用的 Skill 来更高效地完成任务。Skill 提供了专业化的能力和领域知识。

如何使用 Skill：

- 调用：`npx openskills read <skill-name>`（在终端中运行）
  - 多个 Skill：`npx openskills read skill-one,skill-two`
- Skill 内容将加载详细的操作指南
- 输出中会提供基础目录路径，用于解析绑定的资源（references/、scripts/、assets/）

使用说明：

- 仅使用下方 <available_skills> 中列出的 Skill
- 不要重复调用已加载到上下文中的 Skill
- 每次 Skill 调用是无状态的
  </usage>

<available_skills>

<skill>
<name>docx</name>
<description>当用户需要创建、读取、编辑或操作 Word 文档（.docx 文件）时使用。触发场景包括：提及"Word 文档"、".docx"、需要生成带格式的文档（如目录、标题、页码、信头）、从 .docx 中提取或重组内容、插入或替换图片、处理修订批注或评论、或将内容转换为精美的 Word 文档。如果用户要求生成"报告"、"备忘录"、"信函"、"模板"等 Word 格式交付物，使用此 Skill。不适用于 PDF、电子表格、Google Docs 或与文档生成无关的代码任务。</description>
<location>project</location>
</skill>

<skill>
<name>frontend-design</name>
<description>创建具有高品质设计感的生产级前端界面。当用户要求构建 Web 组件、页面、原型、海报或应用时使用（包括网站、落地页、仪表盘、React 组件、HTML/CSS 布局，或对 Web UI 进行样式美化）。生成富有创意、代码精良的解决方案，避免千篇一律的 AI 风格。</description>
<location>project</location>
</skill>

<skill>
<name>mcp-builder</name>
<description>用于创建高质量 MCP（模型上下文协议）服务器的指南，使 LLM 能够通过精心设计的工具与外部服务交互。适用于构建 MCP 服务器以集成外部 API 或服务，无论是 Python（FastMCP）还是 Node/TypeScript（MCP SDK）。</description>
<location>project</location>
</skill>

<skill>
<name>pdf</name>
<description>只要涉及 PDF 文件就使用此 Skill。包括：读取或从 PDF 中提取文本/表格、合并或拆分多个 PDF、旋转页面、添加水印、创建新 PDF、填写 PDF 表单、加密/解密 PDF、提取图片、对扫描件执行 OCR 使其可搜索。如果用户提到 .pdf 文件或要求生成 PDF，使用此 Skill。</description>
<location>project</location>
</skill>

<skill>
<name>pptx</name>
<description>任何时候只要涉及 .pptx 文件就使用此 Skill — 无论是作为输入还是输出。包括：创建幻灯片、演示文稿或报告；读取、解析或从 .pptx 中提取文本（即使提取的内容将用于其他地方，如邮件或摘要）；编辑、修改或更新现有演示文稿；合并或拆分幻灯片文件；处理模板、布局、演讲者备注或评论。当用户提及"幻灯片"、"演示"、"PPT"或引用 .pptx 文件名时触发此 Skill。</description>
<location>project</location>
</skill>

<skill>
<name>skill-creator</name>
<description>创建新 Skill、修改和优化现有 Skill，以及评估 Skill 性能。当用户希望从头创建 Skill、编辑优化现有 Skill、运行评估测试、进行性能基准对比，或优化 Skill 的描述以提升触发准确率时使用。</description>
<location>project</location>
</skill>

<skill>
<name>webapp-testing</name>
<description>使用 Playwright 进行本地 Web 应用交互和测试的工具包。支持验证前端功能、调试 UI 行为、捕获浏览器截图和查看浏览器日志。</description>
<location>project</location>
</skill>

</available_skills>

<!-- SKILLS_TABLE_END -->

</skills_system>

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
