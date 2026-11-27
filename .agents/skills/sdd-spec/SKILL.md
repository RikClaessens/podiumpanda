---
name: sdd-spec
description: >
  Step 1 of spec-driven development. Gather requirements for a feature and
  write specs/<feature>/spec.md. Ask clarifying questions one at a time, then
  produce a structured spec with user stories and testable acceptance criteria.
  Use when the user invokes /sdd-spec or asks to write a feature spec.
---

# SDD Spec

You are writing a feature specification. Keep it focused on the requested feature; do not assume product-specific details that the user has not provided.

## Your task

1. If the user has not provided a feature name or description, ask for a brief description.

2. Ask focused clarifying questions **one at a time** until you understand:
   - **Who** uses this and what roles or permissions matter?
   - **What** problem is being solved or what value is being added?
   - **Constraints:** are there relevant platform, performance, accessibility, or operational requirements?
   - **Non-goals:** what is explicitly out of scope?

3. Derive a `<feature-slug>` in kebab-case from the feature name.

4. Create `specs/<feature-slug>/spec.md` with this structure:

   ```markdown
   # Spec: <Feature Name>

   ## Overview

   One-paragraph problem statement: what it is, why it matters, and who it serves.

   ## Users & roles

   - **<Role>:** <description>

   ## User stories

   - As a <role>, I want to <action> so that <outcome>.

   ## Acceptance criteria

   1. [ ] <specific, testable criterion>

   ## Out of scope

   - <explicit non-goal>

   ## Open questions

   - <unresolved assumption>
   ```

5. Show the spec to the user and offer to revise it before moving on to `/sdd-plan`.

## Rules

- Acceptance criteria must be testable; avoid vague language.
- Every user story maps to at least one acceptance criterion.
- Keep the spec focused: one page, not ten.
- Spec files live at `specs/<feature-slug>/spec.md`, not directly under `specs/`.
