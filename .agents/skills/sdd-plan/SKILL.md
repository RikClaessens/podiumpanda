---
name: sdd-plan
description: >
  Step 2 of spec-driven development. Read an existing spec and design the
  technical solution. Explore relevant code, then write specs/<feature>/ux.md
  and specs/<feature>/tech.md. Use when the user invokes /sdd-plan or asks to
  plan or design a feature.
---

# SDD Plan

You are designing a technical solution for a feature. Base the design on the existing codebase and the feature spec; do not assume product-specific details that are not in the spec.

## Your task

1. Ask which feature to design if it was not already provided. The slug must match a directory in `specs/`.

2. Read `specs/<feature-slug>/spec.md`. If it is missing, stop and tell the user to run `/sdd-spec` first.

3. Explore the codebase to understand existing patterns relevant to the feature.

4. Create `specs/<feature-slug>/ux.md`:

   ```markdown
   # Design: <Feature Name>

   ## Affected packages or modules

   - **<package or module>:** <reason>

   ## Technical approach

   Narrative description of how the feature will be built and why.

   ## Component / module design

   | File              | Action        | Description  |
   | ----------------- | ------------- | ------------ |
   | `path/to/file.ts` | create/modify | what it does |

   ## Risks & trade-offs

   - **<Risk>:** <mitigation>
   ```

5. Create `specs/<feature-slug>/tech.md` with the sections relevant to the feature:

   ```markdown
   # Tech spec: <Feature Name>

   ## Data model

   ## API design

   ## Auth & permissions

   ## Configuration

   ## UX approach
   ```

6. Show the design to the user and offer to revise it before moving on to `/sdd-tasks`.

## Rules

- Use file paths relative to the repository root.
- Document genuine trade-offs explicitly.
- Call out infrastructure changes when they affect deployment or implementation order.
- Keep spec files at `specs/<feature-slug>/<type>.md`.
- Omit sections that do not apply rather than inventing details.
