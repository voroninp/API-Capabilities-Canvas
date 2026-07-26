# Development Guide

This guide covers local setup, the normal change workflow, code conventions, UI expectations, debugging, and common extension tasks. Read [ARCHITECTURE.md](ARCHITECTURE.md) before changing a layer boundary and [DOMAIN_MODEL.md](DOMAIN_MODEL.md) before changing data behavior.

## Prerequisites

- Node.js 22 or newer.
- Corepack enabled for the current Node installation.
- A browser with IndexedDB and ES2023 support.
- VS Code is optional, but the repository includes a task and browser launch configuration.

The project pins pnpm 10.15.0 in `package.json`. Use Corepack rather than relying on a machine-wide pnpm installation:

```powershell
corepack pnpm install --frozen-lockfile
```

`--frozen-lockfile` fails when `package.json` and `pnpm-lock.yaml` disagree. That is useful in onboarding and CI because dependency resolution stays reproducible.

## Local Workflow

Start Vite:

```powershell
corepack pnpm dev
```

The VS Code task **Start Vite dev server** uses a stricter form:

```powershell
corepack pnpm dev --host 127.0.0.1 --port 5173 --strictPort
```

The corresponding **Run API Capabilities Canvas** launch configuration starts that task and opens Microsoft Edge at `http://127.0.0.1:5173/`.

Use watch mode beside the server while changing behavior:

```powershell
corepack pnpm test:watch
```

Before review, run the complete local/CI contract:

```powershell
corepack pnpm check
```

It runs TypeScript, oxlint, all Vitest suites, and a production Vite build in that order. Fix the first failing stage before interpreting later output.

## Source Layout

| Path | Owns | Must not own |
| --- | --- | --- |
| `src/domain/` | Types, aggregate factories, immutable mutations, selectors, semantic validation. | React, IndexedDB, DOM downloads, external document serialization. |
| `src/db/` | Dexie schema, transactions, and task-oriented repository functions. | UI state and business validation. |
| `src/features/interchange/` | Versioned runtime decoding and native JSON envelopes. | IndexedDB transactions or visual feedback. |
| `src/features/export/` | OpenAPI/XLSX mapping and browser download mechanics. | React component state. |
| `src/features/library/` | Multi-canvas listing, creation, import, duplication, deletion, and exports. | Domain cascade implementation. |
| `src/features/workspace/` | Active-canvas composition, editors, history, autosave, and workspace routing. | Persistent schema declarations. |
| `src/test/` | Shared test-environment initialization. | Production helpers. |

Keep a new helper in the narrowest owning feature until more than one feature genuinely needs it.

## How To Approach A Change

Work from behavior outward:

1. Identify the invariant or mapping in the domain, repository, interchange, or export module that owns it.
2. Add or adjust a focused test at that boundary.
3. Make the smallest pure behavior change.
4. Run the narrow test.
5. Connect the behavior to React through existing mutation/repository APIs.
6. Add a component test when focus, keyboard behavior, or orchestration is part of the contract.
7. Run `corepack pnpm check`.
8. Exercise the changed workflow at desktop and narrow mobile widths.

Avoid implementing reference cleanup, validation, or export mapping only inside an event handler. That makes behavior inaccessible to imports, tests, and future interfaces.

## TypeScript Conventions

The application and tooling use separate project references, both with no emit. Important compiler rules include:

- `noUnusedLocals` and `noUnusedParameters`.
- `noFallthroughCasesInSwitch`.
- `verbatimModuleSyntax`, so type-only imports use `import type`.
- `erasableSyntaxOnly`, so avoid runtime TypeScript constructs that cannot be erased cleanly.
- Bundler module resolution for application source.
- ES2023 as the runtime target.

Follow the established source style:

- Prefer `readonly` domain fields and arrays.
- Return new aggregates from domain mutations; do not mutate arguments.
- Use descriptive identifiers rather than single-letter names.
- Use single quotes and no semicolons.
- Let TypeScript infer local types; annotate exported contracts and non-obvious boundaries.
- Accept `unknown` at runtime trust boundaries and narrow it with Zod or explicit checks.
- Keep comments for intent or non-obvious constraints, not line-by-line narration.
- Do not use a type assertion to make imported JSON look trustworthy.

The repository has no formatter command. Preserve local formatting and let typecheck plus oxlint catch objective problems.

## Domain Change Patterns

### Add A Field

Update every representation of the shape:

1. Domain interface and `createApiCanvas` default.
2. `sampleCanvas` when the field helps demonstrate behavior.
3. Zod schema for imported JSON.
4. Semantic validation when the field has an invariant.
5. Duplication or reference rewriting if identity is involved.
6. Repository migration if old IndexedDB records cannot satisfy the new domain type.
7. Native JSON migration if exported version 1 files cannot satisfy it.
8. Relevant external exports.
9. UI editor and focused tests.

The compiler cannot identify missing runtime migration behavior. Treat this checklist as part of the field's implementation.

### Add A Mutation

- Put it in `src/domain/mutations.ts`.
- Receive the complete canvas and explicit entity IDs.
- Preserve unrelated records and `createdAt`.
- Refresh `updatedAt` only for a real accepted mutation.
- Return the original canvas for invalid no-op commands when the caller uses object identity to avoid false history entries.
- Document and test cascades, rewritten references, and any discarded source data.
- Call it through the workspace's `applyChange` path so undo, redo, dirty state, and autosave remain coherent.

### Expand Structured Schema Support

Do not merely add another input to the editor. Structured mode is allowed only when the conversion is lossless.

1. Add the accepted keyword to the appropriate allowlist in `schemaBuilder.ts`.
2. Extend `StructuredPropertyDraft` if the value needs editable state.
3. Map it in both `schemaToStructuredProperties` and `buildStructuredSchema`.
4. Add a round-trip assertion proving `build(schemaToDraft(schema))` equals the original schema.
5. Keep rejecting similar unsupported forms so the mode boundary remains explicit.

If exact round-trip behavior is not practical, leave the schema in JSON mode.

## React And State Conventions

The application intentionally has no global state library. IndexedDB is the durable source for the library, while the workspace keeps one loaded aggregate and small UI state.

- Keep domain values controlled by their owning page.
- Use pure domain mutations to derive the next canvas.
- Pass one `applyChange` callback into capability tabs.
- Keep draft text local only when commit/cancel behavior requires it.
- Do not put transient focus, menu, or error-banner state into `ApiCanvas`.
- Keep fatal loading failures separate from recoverable action failures.
- Preserve route canonicalization for unknown workspace tabs.

When extracting a component, extract around a coherent state or behavior boundary. File length alone is not a useful abstraction criterion.

### Inline Editing Contract

Inline values display as text until activated. Keyboard behavior is part of the component API:

- `Enter` commits and restores focus to the field trigger.
- `Escape` cancels and restores focus to the field trigger.
- Pointer or `Tab` blur commits without stealing natural focus.
- Empty or unchanged combobox text does not emit a commit.
- A case-insensitive existing combobox label selects that option; other text creates a new value through the parent callback.

Preserve this distinction when adding another inline editor.

## Accessibility And Responsive UI

Accessibility is a behavior requirement, not a final CSS pass.

- Use native buttons, inputs, selects, textareas, links, and headings.
- Give every control a visible label or an `aria-label` that names its target and action.
- Mark decorative icons `aria-hidden`.
- Keep `:focus-visible` treatment intact.
- Restore focus after keyboard-completed temporary editors.
- Use live status semantics for asynchronous save state and suitable alert semantics for errors.
- Keep destructive commands explicit and confirmed.
- Do not encode validation severity by color alone.
- Preserve at least 44 by 44 CSS pixels for mobile action targets.
- Test long API, role, operation, path, schema, and response names for wrapping rather than overlap.

The mobile layout intentionally compresses the application shell, changes summaries/actions to two columns, and enlarges controls. Inspect both a narrow phone viewport and a normal desktop viewport after changing shared CSS.

## Routing And Static Hosting

Routes are defined in `src/App.tsx`:

| Route | View |
| --- | --- |
| `/` | API library. |
| `/api/:apiId/:tab` | Active workspace. |
| Any other route | Redirect to `/`. |

These paths appear after the URL hash because `main.tsx` uses `HashRouter`. The workspace accepts known tabs and redirects an unknown tab to `/api/:apiId/canvas`.

Do not replace `HashRouter` with browser-history routing unless the deployment server is also configured to rewrite every application route to `index.html`.

## Persistence And Debugging

### Inspect Browser Data

In browser developer tools, open **Application** or **Storage**, then IndexedDB and `api-capabilities-canvas`. The `apiCanvases` table contains complete records.

Useful distinctions:

- Missing sample after deleting everything is expected; populate runs only for a new database.
- A workspace at `localhost` is different from one at `127.0.0.1`.
- Reload preserves the saved aggregate but clears in-memory undo history.
- `unsaved` means the debounce has not completed yet.
- `save failed` means the current React state is still present but the repository write rejected.

When debugging migration behavior, export JSON first. Deleting the database is destructive and is not a substitute for testing an upgrade from old records.

### Trace A Validation Issue

Each issue includes a machine-oriented `path`, such as `operations.Search products.responses.0`. Search `validation.ts` for the message or path prefix, then fix the owning invariant rather than suppressing display.

Validation paths are diagnostic identifiers, not stable external API. Tests should assert the relevant path and severity without coupling to unrelated issue ordering.

### Trace An Export Failure

1. Run `validateApiCanvas` and inspect error paths.
2. Confirm whether that export intentionally treats the path as blocking.
3. Build the in-memory document or buffer directly in a focused test.
4. For OpenAPI, validate serialized output with Swagger Parser.
5. For XLSX, load the buffer back through ExcelJS and inspect cells.
6. Keep browser download behavior as a separate test concern.

## Dependencies And Bundles

Use a dependency only when the platform or existing libraries do not provide a clear solution. Before adding one:

1. Check browser and Node 22 APIs.
2. Check whether Dexie, Zod, ExcelJS, YAML, React Router, or Testing Library already owns the problem.
3. Add it with `corepack pnpm add` or `corepack pnpm add -D` so both manifest and lockfile change.
4. Import large, rare exporters dynamically.
5. Run the production build and inspect chunk sizes.

Vite currently separates ExcelJS, YAML, Dexie, React Router, Lucide, and remaining vendor code. The warning limit is 1000 kB because ExcelJS is intentionally large and isolated. A larger limit is not permission to move it into the initial editor path.

## CI And Deployment

Pull requests run `.github/workflows/quality.yml`. Pushes to `main` run `.github/workflows/deploy-pages.yml`, which performs the same `pnpm check` before uploading `dist/` and deploying to the `github-pages` environment.

Both workflows use:

- Ubuntu latest.
- Node 22.
- pnpm 10.15.0.
- Frozen lockfile installation.
- Concurrency cancellation for obsolete runs.

Do not commit `dist/`; GitHub Actions builds the deployment artifact from source.

## Definition Of Done

A change is complete when:

- The owning invariant is implemented outside UI glue.
- Existing data and interchange compatibility have been considered.
- Focus, labels, failure states, and mobile layout remain usable.
- Focused tests cover the changed behavior and important edge values.
- Documentation describes new intent or behavior.
- `corepack pnpm check` passes.
- The changed browser workflow has been exercised manually.
