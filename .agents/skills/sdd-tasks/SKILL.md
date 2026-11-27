---
name: sdd-tasks
description: >
  Step 3 of spec-driven development. Read the spec and design for a feature
  and break them into ordered, independently executable implementation tasks.
  Write specs/<feature>/tasks.md. Use when the user invokes /sdd-tasks or asks
  to create implementation tasks.
---

# SDD Tasks

You are breaking a feature into implementation tasks. Use its spec and design as the source of truth; do not add product requirements that are not described there.

## Your task

1. Ask which feature to generate tasks for if it was not already provided.

2. Read all applicable design documents:
   - `specs/<feature-slug>/spec.md`
   - `specs/<feature-slug>/ux.md`
   - `specs/<feature-slug>/tech.md`

   If any required document is missing, stop and tell the user to run `/sdd-spec` or `/sdd-plan` first.

3. Break the work into granular, ordered tasks. Order tasks according to actual dependencies in the codebase and design, for example:
   - Foundational or infrastructure changes before work that depends on them.
   - Data model or API changes before their consumers.
   - Backend and shared contracts before frontend integration when applicable.

4. Create `specs/<feature-slug>/tasks.md`:

   ```markdown
   # Tasks: <Feature Name>

   > Spec: [spec.md](spec.md) | Design: [ux.md](ux.md) | Tech: [tech.md](tech.md)

   ## Task 1: <title>

   **Files:** `path/to/file.ts` (create/modify)

   <Short description of what to do and why.>

   **Acceptance criteria:**

   - [ ] <specific, verifiable outcome>

   **Test approach:** <Vitest unit / type-check / manual, with a specific assertion or file>

   ---
   ```

5. Show the task list to the user and confirm it is ready before finishing.

## Rules

- Each task should be completable in one session (roughly two hours or less).
- Every acceptance criterion from the spec must be covered.
- Tasks must be independently executable where possible and must not have circular dependencies.
- Identify deployment, migration, or other operational steps when relevant.
- Test approaches must name the file or describe the assertion concretely.
