---
name: sdd-implement
description: >
  Step 4 of spec-driven development. Implement the next pending task from a
  feature task list using TDD (red-green-refactor). Run tests, type-check, and
  lint; check off the task when done. Use when the user invokes /sdd-implement
  or asks to implement a feature task.
---

# SDD Implement

Implement a feature task using TDD. Follow the established patterns in the codebase.

## Your task

1. Ask which feature to implement if it was not already provided. If known, implement the next pending task from `specs/<feature-slug>/tasks.md`.

2. Read `specs/<feature-slug>/tasks.md`. Find the **first task with all acceptance-criteria checkboxes unchecked**. Show it to the user and confirm before proceeding.

3. Implement using **red-green-refactor TDD**:

   ### Red — write a failing test first
   - Write the test before implementation code.
   - This project uses Vitest; follow existing test-file placement and naming conventions.
   - Run `pnpm test` and confirm the test fails for the expected reason.

   ### Green — implement the minimum to pass
   - Write only enough code to make the test pass.
   - Follow existing codebase patterns.
   - Use strict TypeScript; do not introduce `any` without justification.

   ### Refactor — clean up
   - Remove duplication, improve naming, and simplify logic.
   - Keep tests green throughout.

4. After implementation, run the relevant project checks:

   ```bash
   pnpm test       # Vitest
   pnpm build      # production build
   pnpm typecheck  # TypeScript
   pnpm lint       # oxlint
   ```

5. Replace `- [ ]` with `- [x]` for completed criteria in `specs/<feature-slug>/tasks.md`.

6. Report what was implemented, test coverage, checks run, and which task is next.

## Rules

- Never skip the Red step.
- Never mark a task done with failing tests, lint, or type-check results.
- If a task needs splitting, update `tasks.md` first.
- For work that cannot reasonably use TDD, explain why and define a concrete verification approach.
