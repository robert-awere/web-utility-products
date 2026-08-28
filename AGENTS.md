# Web Utility Products — Agent Safety Rules

Repository:
robert-awere/web-utility-products

This is a monorepo containing multiple independent web utilities.

## 1. Mandatory utility location

ALL web utilities must live under:

sites/<utility-slug>/

Example:

sites/utility99/

Never create a utility at:

<repo-root>/<utility-slug>/
./
apps/
public/

Application files must never be placed directly in the repository root.

## 2. Establish the target before editing

Before making changes, define:

TARGET_SITE=sites/<utility-slug>

Example:

TARGET_SITE=sites/utility99

Confirm the target path before creating, editing, moving or deleting files.

If the intended utility is unclear, STOP and ask the user.

## 3. Site isolation

While working on one utility:

You MAY modify:

sites/<target-utility>/**

You MUST NOT modify:

sites/<another-utility>/**

unless the user explicitly requests it.

Never move, rename, overwrite or delete another utility.

Supporting repository files such as:

specs/
research/
logs/
shared/
README.md
CLAUDE.md

may only be changed when required by the task or existing repository workflow.

## 4. Repository verification

Before making changes, verify:

git branch --show-current
git remote get-url origin
git status

Expected repository:

robert-awere/web-utility-products

If the repository or branch is not what is expected, STOP.

## 5. Mandatory pre-commit check

Before every commit or push run:

git status
git diff --name-only
git diff --cached --name-only

Inspect every changed path.

Application changes must belong only to:

sites/<target-utility>/

If application files from another utility appear:

STOP.
DO NOT COMMIT.
DO NOT PUSH.
Report the unexpected changes to the user.

## 6. Commit discipline

One utility per commit/push batch.

Preferred commit format:

<utility-slug>: <short description>

Do not combine unrelated utility changes in one commit.

## 7. Vercel deployment rule

Every utility must have its OWN Vercel project.

The Vercel Root Directory MUST be:

sites/<utility-slug>

Example:

sites/utility99

Never configure a utility project with:

./

Never use the repository root as the Vercel Root Directory.

Recommended Vercel settings:

Include files outside root directory:
DISABLED

Skip deployments when there are no changes
to the root directory or dependencies:
ENABLED

## 8. Domain safety

Never:

- move a domain between Vercel projects
- alter DNS
- alter nameservers
- delete a production domain
- change another utility's Vercel configuration

unless the user explicitly requests it.

## 9. Before declaring deployment complete

Verify:

1. Correct GitHub repository
2. Correct branch
3. Correct TARGET_SITE
4. Correct Vercel project
5. Root Directory = sites/<utility-slug>
6. Deployment preview shows the intended utility
7. Production domain shows the intended utility

If any check fails, STOP and report it.

## 10. Fail-safe

Never guess a repository path, deployment target,
Vercel project or domain.

When uncertain:
STOP and ask the user.
