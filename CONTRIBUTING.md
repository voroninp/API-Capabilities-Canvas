# Contributing

Contributions should make the application easier to trust and the code easier to learn from. A small, explicit change with a focused proof is preferable to a broad cleanup that obscures behavior.

## Start Here

Read the documents relevant to the change:

- [README.md](README.md) for product scope and commands.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for dependency direction and tradeoffs.
- [docs/DOMAIN_MODEL.md](docs/DOMAIN_MODEL.md) for aggregate invariants and mutation consequences.
- [docs/DATA_AND_EXPORTS.md](docs/DATA_AND_EXPORTS.md) for persistence, interchange, migrations, and output mappings.
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for implementation patterns.
- [docs/TESTING.md](docs/TESTING.md) for proof strategy.
- [docs/API_REFERENCE.md](docs/API_REFERENCE.md) for exported module contracts.

If implementation and documentation disagree, verify behavior with source and tests, then correct both in the same contribution.

## Set Up

Use Node.js 22 or newer and the repository-pinned package manager:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Run the full baseline before starting a substantial change:

```powershell
corepack pnpm check
```

A failing baseline should be understood and reported before unrelated edits are mixed into the branch.

## Shape The Change

1. Describe the user-visible behavior or invariant being changed.
2. Identify the module that directly owns that decision.
3. Define one focused check that would fail before the change.
4. Change the smallest coherent behavior slice.
5. Run that focused check immediately.
6. Add adjacent UI or documentation changes only after the behavior is proven.
7. Finish with the full quality gate and browser verification.

Keep unrelated formatting, dependency upgrades, generated output, and refactors out of the change. Reviewers should be able to connect each changed line to the stated outcome.

## Architectural Rules

- Domain code must not import React, Dexie, DOM APIs, YAML, or ExcelJS.
- React handlers should call pure mutations rather than reimplementing graph behavior.
- Components should use repository functions rather than ad hoc IndexedDB queries.
- Imported JSON must cross a runtime decoder before it reaches domain code.
- Semantic validation belongs in the domain layer and returns issues rather than controlling UI directly.
- Artifact builders should remain independent from browser download mechanics.
- Large optional exporters should stay dynamically imported.
- One `ApiCanvas` remains the consistency, persistence, and native interchange aggregate.

Discuss an intentional exception in the change description and update the architecture guide when the dependency model itself changes.

## Data And Compatibility

Every domain-shape change must answer:

- What happens to canvases already stored in IndexedDB?
- What happens when importing an older JSON envelope?
- Does duplication still regenerate every identity-bearing field?
- Do cascade, merge, and rename operations preserve references?
- Does the field belong in OpenAPI, XLSX, both, or neither?
- Does validation need a new error, warning, or informational issue?

Do not silently edit a released Dexie version or interchange schema version. Add explicit migrations and fixture tests as described in [docs/DATA_AND_EXPORTS.md](docs/DATA_AND_EXPORTS.md#versioning-and-migration).

JSON Schema changes require special care. Preserve unknown advanced keywords, keep known keyword types validated, and do not expand structured mode without a lossless round-trip test.

## Code Expectations

- Preserve readonly domain types and immutable mutation behavior.
- Use type-only imports where required by `verbatimModuleSyntax`.
- Avoid unchecked casts at I/O boundaries.
- Give exported functions and types descriptive names.
- Keep defaults valid, readable, and distinct where uniqueness matters.
- Handle `false`, `0`, and empty strings by presence rather than truthiness when they are valid values.
- Keep comments brief and focused on intent that code cannot communicate clearly.
- Match established formatting; the project intentionally has no automatic formatter command.

An abstraction should remove meaningful duplication or clarify ownership. Do not extract a helper or component solely because a file is long.

## Testing Expectations

Add proof at the narrowest owning boundary:

| Change | Expected evidence |
| --- | --- |
| Domain behavior | Unit test for accepted and important rejected cases. |
| Reference mutation | Source/target and unrelated-entity assertions. |
| Validation | Invalid and neighboring valid examples with severity/path checks. |
| Persistence | Fake-IndexedDB integration test, including transaction behavior. |
| Interchange | Runtime fixtures for valid, malformed, and compatible advanced data. |
| OpenAPI | Mapping assertion and Swagger Parser validation. |
| XLSX | Reloaded workbook assertion. |
| Browser download | DOM/object-URL lifecycle test. |
| Keyboard editor | Accessible Testing Library interaction and focus assertion. |
| Layout | Desktop/mobile browser evidence; add automation when risk justifies it. |

Do not weaken an assertion or add a broad timeout to make a failure disappear. Explain and scope unavoidable asynchronous costs, as the workbook suite does.

## Accessibility Review

For every changed interaction, verify:

- Controls use the correct native element.
- Inputs have visible or accessible names.
- Icon-only buttons name both action and target.
- Decorative icons are hidden from assistive technology.
- Keyboard users can enter, commit, cancel, and leave the control.
- Focus is restored after keyboard-completed temporary editing.
- Pointer and Tab blur do not unexpectedly steal focus.
- Async save and error states are announced appropriately.
- Meaning is not conveyed by color alone.
- Mobile targets remain at least 44 by 44 CSS pixels.
- Long content wraps or scrolls without overlap.

Use accessible queries in component tests. A control that cannot be located naturally by role or label often needs an implementation fix rather than a test ID.

## UX And Error States

Test more than the happy path:

- Empty collections and first-item creation.
- Invalid references from imported or legacy data.
- Save rejection while unsaved React state remains available.
- Export rejection without losing the workspace editor.
- Destructive actions canceled at confirmation.
- Long names, paths, media types, and validation messages.
- Narrow mobile viewport and keyboard-only navigation.

Fatal load errors may replace the workspace because no aggregate is available. Recoverable export and action errors should remain local and dismissible.

## Dependencies

Before introducing a package, explain why the browser platform, standard library, or an existing dependency is insufficient.

Add runtime dependencies with:

```powershell
corepack pnpm add package-name
```

Add development-only dependencies with:

```powershell
corepack pnpm add -D package-name
```

Commit both `package.json` and `pnpm-lock.yaml`. Run a production build and note meaningful initial or lazy chunk changes in the PR description. Do not raise bundle warning limits merely to hide an accidental initial-load regression.

## Documentation

Update documentation in the same contribution when changing:

- User workflow, labels, commands, routes, or product boundaries.
- Domain entities, defaults, references, cascades, or validation rules.
- Database/interchange versions or import conflict behavior.
- OpenAPI/XLSX mappings and blocking conditions.
- Exported module names, signatures, or failure behavior.
- Test commands, suite responsibilities, CI, or deployment.
- A tradeoff future contributors could otherwise mistake for an accident.

Prefer explaining intent, consequences, and edge behavior over restating each source line.

## Before Requesting Review

Run:

```powershell
corepack pnpm check
```

Then verify the changed browser path at normal desktop width and a narrow mobile width. For storage or export work, exercise a real IndexedDB save/import or open the produced artifact in a suitable consumer.

Review the final diff for:

- Unrelated edits or generated `dist/` files.
- Debug logging and temporary fixtures.
- New assertions or casts hiding a type/runtime mismatch.
- Missing migration behavior.
- Missing focus, error, and empty states.
- Documentation links and stale behavior descriptions.

## Pull Request Description

Provide enough context for a reviewer to reproduce the reasoning:

1. **Problem:** observable defect, learning goal, or invariant at risk.
2. **Approach:** owning module and key design choice.
3. **Behavior:** what changes and what intentionally does not.
4. **Compatibility:** effect on IndexedDB, JSON interchange, and exports.
5. **Verification:** focused tests, `pnpm check`, and manual browser scenarios.
6. **Screenshots:** desktop/mobile images for meaningful visual changes.
7. **Follow-up:** known residual risk that is explicitly outside this change.

Keep the description factual. Link an issue when one exists, but make the PR understandable on its own.

## Review Priorities

Reviewers should examine, in order:

1. Data loss, broken references, incompatible imports, and invalid generated artifacts.
2. User-visible regressions, inaccessible controls, and unrecoverable error states.
3. Missing tests for the stated behavior and edge values.
4. Dependency direction, unnecessary complexity, and duplicated domain logic.
5. Naming, formatting, and minor readability improvements.

Feedback should identify the violated behavior or principle and, where possible, the smallest proof that would resolve uncertainty.

## CI And Merge

Pull requests run the **Quality** workflow, which installs the frozen lockfile and runs `pnpm check` on Node 22. A push to `main` triggers the Pages workflow; it repeats the complete gate before uploading `dist/`.

Do not merge by bypassing a failing gate. If the workflow reveals an environment-specific problem, reproduce or explain it and fix the underlying contract rather than retrying until it happens to pass.
