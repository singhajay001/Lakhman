# CLAUDE.md

Guidance for Claude Code (claude.ai/code) and other AI assistants working in this repository.

## Current state of the repository — read this first

**This repository contains no source code yet.** As of the latest commit
(`0051c19 "Add files via upload"`), the entire tracked tree is:

```
lakhman-platform    # 0-byte file, no extension, no content
```

There is no application code, no build system, no dependency manifest
(`package.json`, `requirements.txt`, `go.mod`, `pom.xml`, …), no tests, no CI
configuration, and no README. The GitHub API reports the repository size as 0
and detects no language.

Consequences for anyone working here:

- **There is no architecture to describe, and none should be invented.** Do not
  assume a framework, language, or directory layout. If a task refers to
  existing modules, services, or endpoints, they are not in this repository —
  ask where the code actually lives before writing anything.
- **There are no build, test, lint, or run commands.** Nothing can be executed
  or verified until a project is scaffolded.
- **`lakhman-platform` is an empty placeholder.** Its purpose is not documented
  anywhere in the repository. Treat the name as a hint at intent, not as a
  specification. Do not delete or repurpose it without asking.
- **This file must be updated as soon as real code lands.** The "To fill in"
  section below is the checklist.

## Repository facts

| | |
|---|---|
| Remote | `https://github.com/singhajay001/Lakhman` |
| Default branch | `main` |
| Visibility | Public |
| Commits on `main` | 1 |
| Tracked files | 1 (`lakhman-platform`, empty) |

## Git workflow

These conventions apply now and do not depend on what the code turns out to be.

- **Never commit directly to `main`.** Work on a feature branch and push that.
- Claude Code sessions are assigned a branch (e.g. `claude/<topic>-<suffix>`).
  Develop and push there; create it locally if it does not exist. Never push to
  a different branch without explicit permission.
- Push with upstream tracking: `git push -u origin <branch-name>`.
- Retry a push only for network failures, with backoff (2s, 4s, 8s, 16s).
- **Do not open a pull request unless explicitly asked.** There is no PR
  template in the repository; if one is added under `.github/`, follow its
  section structure when writing a PR body.
- If the PR for an assigned branch has already been merged, restart the branch
  from the latest `main` rather than stacking new commits on merged history:
  `git fetch origin main && git checkout -B <branch> origin/main`.
- Write commit messages in the imperative mood with a short subject line and,
  where the change is not self-explanatory, a body explaining *why*.

## Working conventions for AI assistants

- **Verify before asserting.** Because the tree is empty, any claim about
  "existing code" is necessarily unverified. Read the actual files first; if a
  path does not exist, say so rather than guessing at its contents.
- **Do not scaffold a project unprompted.** Choosing a language, framework, or
  directory layout is a product decision. If a task requires code and no stack
  has been specified, ask which stack to use — the choice is hard to reverse
  once dependencies and tooling are committed.
- **Keep the first real commits small and documented.** The first change that
  introduces a stack should also update this file with the build, test, and run
  commands, so the next session does not have to rediscover them.
- **No secrets in the repository.** The repo is public. Keep credentials, API
  keys, and connection strings out of tracked files; use a `.env` file with a
  committed `.env.example` and a `.gitignore` entry once a stack exists.

## To fill in once code exists

Replace the "Current state" section above and complete each item below as it
becomes true. Prefer commands that were actually run and observed to pass over
commands copied from a framework's documentation.

- [ ] **Overview** — what the project does, who uses it, how it is deployed.
- [ ] **Stack** — language(s), runtime versions, framework(s), database.
- [ ] **Setup** — clone-to-running steps, including required env vars.
- [ ] **Commands** — install, build, run/dev server, test (full and single
      test), lint, format, typecheck.
- [ ] **Architecture** — the directory layout and, more importantly, the parts
      that are not obvious from reading a single file: how requests flow, where
      state lives, module boundaries, and any non-standard patterns.
- [ ] **Testing conventions** — framework, where tests live, naming, what is
      expected to pass before a push.
- [ ] **CI** — what runs on push/PR and what must be green to merge.
- [ ] **Gotchas** — anything that has already cost someone an hour.
