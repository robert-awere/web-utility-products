# CLAUDE.md — web-utility-products factory

# CLAUDE.md — Claude-specific instructions

This repository is:

robert-awere/web-utility-products

Before doing any work:

1. Read AGENTS.md.
2. Read PROJECT-RULES.md.
3. Obey both.

AGENTS.md defines repository, Git, Vercel and domain safety.

PROJECT-RULES.md defines the shared build, SEO, design, validation and deployment standards.

## Claude-specific behavior

- Do not begin implementation during a planning/review phase.
- The owner may use `COMMENCE` as explicit authorization to execute.
- Before editing, state the resolved TARGET_SITE.
- Never infer a different target directory from the task name.
- Before every commit or push, inspect:
  - git status
  - git diff --name-only
  - git diff --cached --name-only
- If application changes appear outside TARGET_SITE, stop.
- Do not silently repair or modify another utility.
- Do not change Vercel, DNS, domains or production configuration unless explicitly requested.
- If repository state conflicts with the user's instruction, report the conflict before proceeding.
