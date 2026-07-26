# Testing Guide

The test suite is designed around behavior boundaries rather than implementation coverage alone. Pure domain logic receives fast unit tests, browser APIs are isolated, IndexedDB runs against an in-memory implementation, and generated artifacts are read by real consumers where practical.

## Commands

```powershell
# One complete Vitest run
corepack pnpm test:unit

# Watch affected suites while developing
corepack pnpm test:watch

# Full local and CI gate
corepack pnpm check
```

Run one file through Vitest when iterating:

```powershell
corepack pnpm exec vitest run src/domain/validation.test.ts
```

Run matching test names:

```powershell
corepack pnpm exec vitest run -t "rejects malformed path templates"
```

Use the full gate before review even when the focused suite passes. Type errors, lint rules, and production bundling cover different failure modes.

## Environment

`vitest.config.ts` configures:

- `jsdom` for browser DOM APIs.
- Vitest globals for `describe`, `test`, `expect`, and mocks.
- `src/test/setup.ts` before every test file.

The setup file installs:

- `@testing-library/jest-dom` matchers such as `toHaveFocus`.
- `fake-indexeddb/auto`, which provides browser-like IndexedDB globals in Node.

Tests are colocated with the source module they protect. There is no separate mirrored test tree.

## Current Suite Inventory

The current gate executes 54 tests in 10 files.

| Suite | Tests | Contract covered |
| --- | ---: | --- |
| `src/db/apiCanvasRepository.test.ts` | 2 | First-open seeding, intentional empty state, idempotent sample restoration. |
| `src/domain/mutations.test.ts` | 10 | Contract defaults, guarded factories, cascade deletion, role/operation merge semantics. |
| `src/domain/selectors.test.ts` | 6 | Canvas creation, joined row ordering, unassigned operations, aggregate counts. |
| `src/domain/validation.test.ts` | 9 | Severity, metadata, identifiers, refs, schema sources, path templates, labels, media types. |
| `src/features/export/download.test.ts` | 2 | Text/binary MIME types, clicks, DOM cleanup, delayed URL revocation. |
| `src/features/export/openApi.test.ts` | 6 | Parser-valid OpenAPI, YAML, shared paths, boolean schemas, empty examples, metadata blocking. |
| `src/features/export/workbook.test.ts` | 1 | Operation sorting in a generated and reloaded XLSX workbook. |
| `src/features/interchange/jsonInterchange.test.ts` | 5 | Single/workspace round trips, duplicate IDs, typed known keywords, preserved advanced keywords. |
| `src/features/workspace/CanvasModelTabs.test.tsx` | 7 | Existing/new operation assignment, inline text/edit states, focus return, merge UI, output order. |
| `src/features/workspace/schemaBuilder.test.ts` | 6 | Lossless supported round trip, four unsupported forms, persistent new-property naming. |

Parameterized cases count individually in Vitest, which is why the total is larger than the number of visible `test` calls.

## What To Test Where

| Change | Minimum focused proof |
| --- | --- |
| Domain factory or mutation | Input/output test covering references, unrelated data preservation, timestamps or no-op identity where relevant. |
| Selector | Joined value and ordering test, including a missing-reference edge if behavior changes. |
| Validation rule | Positive and negative cases asserting severity and path. |
| Database operation | Fake-IndexedDB integration test across the relevant transaction. |
| Imported shape | Zod/parse test with valid, malformed, and forward-compatible data. |
| OpenAPI mapping | Object assertion plus parser validation when document structure changes. |
| Workbook mapping | Reload the generated buffer with ExcelJS and inspect cells/sheets. |
| Browser download | Mock Blob URL functions and anchor click; use fake timers for revocation. |
| Keyboard/focus behavior | Testing Library render, activate, commit/cancel, and `toHaveFocus`. |
| Responsive visual change | Browser checks at desktop and mobile widths; automated screenshot coverage is not currently configured. |

Prefer the narrowest test that can falsify the behavior. Add broader integration coverage only where orchestration itself is the risk.

## Domain Test Patterns

### Start From The Teaching Sample

`sampleCanvas` is useful when a test needs a coherent graph with roles, use cases, reused operations, contracts, and schemas. Clone only the arrays or records the test changes:

```ts
const canvas = {
  ...sampleCanvas,
  operations: sampleCanvas.operations.map((operation) =>
    operation.id === 'operation-search-products'
      ? { ...operation, name: 'Find products' }
      : operation,
  ),
}
```

Do not mutate `sampleCanvas`; it is imported by production seeding and many suites.

Use `createApiCanvas` when the behavior needs an empty aggregate. Factories use `crypto.randomUUID()` and current timestamps, so assert shape and invariants rather than exact generated values.

### Test Reference Consequences

A deletion or merge test should assert both sides:

- The source entity is absent.
- Dependent references are removed or moved as documented.
- Unrelated entities remain.
- The target's data wins where a merge discards source detail.

For rejected commands such as a self-merge or parent-less create, use `toBe(original)` to prove it is a true no-op rather than merely deep-equal output.

### Test Validation Without Ordering Coupling

Validation can report several independent issues. Search for the issue that matters:

```ts
const issues = validateApiCanvas(canvas)

expect(issues).toEqual(
  expect.arrayContaining([
    expect.objectContaining({
      severity: 'error',
      path: 'name',
    }),
  ]),
)
```

Assert complete arrays only when issue ordering is itself part of the intended behavior. Include an accepted neighboring value for syntax validators, so a stricter-than-required regex is caught.

## Runtime Boundary Tests

### JSON Interchange

Round-trip tests should compare the decoded `api` or `apis` content, not volatile `exportedAt` metadata. Add explicit malformed input tests for known keyword types; do not rely on TypeScript fixtures to represent untrusted JSON.

When adding schema-version migration, keep static JSON fixtures for every old version. A test that serializes with current code and immediately parses with current code cannot prove backward compatibility.

### IndexedDB

Repository tests use the exported Dexie database against fake IndexedDB. Isolate test state by deleting or clearing the database in lifecycle hooks and closing open connections when necessary.

Test observable repository behavior, not Dexie internals:

- Result values and ordering.
- Records present after a transaction.
- Idempotency.
- Atomicity when introducing a failure path.
- Upgrade behavior when adding a database version.

The production populate hook runs in fake IndexedDB too. Account for the seeded canvas explicitly instead of treating it as mysterious test data.

## Artifact Tests

### OpenAPI

Object assertions are good for precise mapping. A real parser catches structural incompatibility that local interfaces may miss:

```ts
const document = buildOpenApiDocument(canvas)
await SwaggerParser.validate(JSON.parse(JSON.stringify(document)))
```

The JSON round trip removes any accidental non-JSON values before parsing and mirrors exported JSON. Add focused assertions for values that truthiness often mishandles, including `false`, `0`, and empty strings.

Test YAML separately when generation behavior changes. YAML and JSON share one document builder, so duplicate mapping assertions are unnecessary.

### XLSX

Workbook generation dynamically imports ExcelJS and performs ZIP work, so the focused suite has a 15-second timeout. Keep long timeouts scoped to this test rather than increasing the global Vitest timeout.

Reload the returned buffer through ExcelJS, then assert sheet names, row order, headers, values, and formatting relevant to the behavior. Do not inspect private workbook internals.

### Downloads

The download helper is independent from document generation. Mock:

- `URL.createObjectURL`.
- `URL.revokeObjectURL`.
- `HTMLAnchorElement.prototype.click`.

Use fake timers to prove revocation happens after the click task. Always restore timers and mocks so unrelated jsdom tests remain deterministic.

## Component Tests

Use Testing Library queries that reflect accessible usage:

1. `getByRole` with a name.
2. `getByLabelText` for form fields.
3. Visible text when it uniquely identifies static output.
4. Test IDs only as a last resort; the application currently does not require them.

For inline editing, test the complete interaction:

1. Locate the display trigger by accessible name.
2. Activate it.
3. Change the input.
4. Commit with Enter or cancel with Escape.
5. Assert the callback result and final focus.

Pointer blur and keyboard commit have intentionally different focus behavior. A test should not call a component's internal function or assume state synchronously when the user-visible event can prove it.

Component tests should not duplicate pure mutation assertions. For merge UI, prove confirmation and integration with the mutation; let the domain suite exhaustively prove graph rewriting.

## Manual Browser Checks

Automated tests do not currently cover layout screenshots, actual IndexedDB implementation differences, or real browser downloads. For a user-facing change, check:

### Desktop

- Library create, duplicate, import, export, and delete actions.
- Workspace tab navigation and unknown-tab redirect.
- Inline keyboard commit/cancel and focus return.
- Undo/redo, autosave status, and reload persistence.
- Validation errors that block the relevant export.
- JSON, YAML, and XLSX files open in an appropriate consumer.
- Browser console has no errors or accessibility warnings caused by the change.

### Mobile

- Header and navigation do not consume most of the viewport.
- Two-column summaries/actions collapse cleanly for long content.
- Buttons and inputs remain at least 44 CSS pixels tall/wide where tapped.
- Long names and paths wrap without overlapping adjacent controls.
- Horizontal tables or work surfaces remain intentionally scrollable where needed.

Use a current Chromium browser at minimum. Cross-browser behavior is most relevant for IndexedDB and Blob downloads.

## Missing Coverage And Risk

The suite currently has no enforced line/branch coverage threshold and no end-to-end browser runner. That is intentional at the current project size, but it leaves residual risk in:

- Full library/workspace orchestration.
- Autosave timing and repository failures in rendered React.
- Browser-native file picker and download behavior.
- Responsive layout regressions.
- Future Dexie version upgrades.
- Real GitHub Pages deployment configuration.

When one of these areas changes repeatedly or fails in production, add the narrowest reliable integration or browser test rather than chasing a percentage target.

## Troubleshooting

### A Test Passes Alone But Fails In The Suite

Look for leaked fake timers, mocks, document nodes, or open Dexie connections. Restore global behavior in `afterEach` and avoid sharing mutable fixtures.

### A Workbook Test Is Slow

Run only `workbook.test.ts` during iteration. Verify the dynamic import is resolving; do not replace ExcelJS with a fake when the test's purpose is artifact compatibility.

### IndexedDB Data Appears Unexpectedly

The populate hook seeds `sampleCanvas` on first database creation. Ensure setup/teardown ordering is awaited and that the database name is not shared with another concurrently running suite.

### An OpenAPI Parser Error Is Vague

Serialize the document with indentation, inspect the reported path, and compare it to the corresponding contract. Keep the parser check, then add a precise local assertion that explains the regression better next time.
