---
name: sdd-review
description: >
  Step 5 of spec-driven development. Review a completed feature implementation
  against its spec and acceptance criteria. Run project checks and produce a
  ✅/⚠️/❌ report. Use when the user invokes /sdd-review or asks to review a
  feature implementation.
---

# SDD Review

Review a feature implementation against its requirements and intended design. Base findings on repository evidence and do not assume product-specific expectations.

## Your task

1. Ask which feature to review if it was not already provided.

2. Read the applicable feature documents:
   - `specs/<feature-slug>/spec.md` — acceptance criteria
   - `specs/<feature-slug>/ux.md` and `tech.md` — intended technical approach
   - `specs/<feature-slug>/tasks.md` — task completion status

3. Run the project checks:

   ```bash
   pnpm test       # Vitest
   pnpm build      # production build
   pnpm typecheck  # TypeScript
   pnpm lint       # oxlint
   ```

4. For each acceptance criterion, mark it as:
   - ✅ **Met** — fully satisfied
   - ⚠️ **Partial** — mostly met with a gap or caveat
   - ❌ **Not met** — missing or broken

5. Compare the implementation against the design. Note significant deviations and assess whether they are justified.

6. Check for common issues:
   - **Test coverage:** Are the happy path and key edge cases covered?
   - **Type safety:** Is there unwarranted `any` or `@ts-ignore`?
   - **Accessibility:** Are accessible names, keyboard navigation, and focus management handled where relevant?
   - **Security:** Is untrusted input validated at appropriate boundaries, and are secrets kept out of source?
   - **Error handling:** Are failures handled clearly and consistently?

7. Produce a review report:

   ```markdown
   # Review: <Feature Name>

   ## Automated checks

   - Tests: ✅/❌ (N passing, N failing)
   - Build: ✅/❌
   - Type-check: ✅/❌
   - Linting: ✅/❌

   ## Acceptance criteria

   1. ✅/⚠️/❌ <criterion> — <note>

   ## Design deviations

   - <deviation>: justified/not justified — reason

   ## Issues found

   - **[high/medium/low]** <description and location>

   ## Verdict

   ✅ Feature complete — ready to merge.
   OR
   ⚠️ Feature needs fixes — see issues above.
   ```

## Rules

- Explicitly assess every acceptance criterion.
- Any ❌ or high-severity issue means the verdict must be "needs fixes".
- Focus on correctness, safety, and spec compliance rather than style preferences.
