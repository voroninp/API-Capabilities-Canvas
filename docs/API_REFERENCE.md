# Internal API Reference

This reference catalogs the modules exported by the application source. The repository is an application rather than a published package, so these exports are internal contracts: change them deliberately, update every caller, and preserve documented behavior where tests or persisted data depend on it.

For modeling intent and invariants, read [DOMAIN_MODEL.md](DOMAIN_MODEL.md). For storage and format compatibility, read [DATA_AND_EXPORTS.md](DATA_AND_EXPORTS.md).

## Conventions

- Domain values expose readonly fields and collections.
- Domain mutations return a complete `ApiCanvas` rather than mutating their argument.
- Repository and exporter functions are asynchronous only when they cross an I/O or dynamic-import boundary.
- Imported JSON is `unknown` until decoded by Zod.
- Function names beginning with `build` return an in-memory artifact; `download` functions perform DOM side effects.
- Error-returning domain validation uses issue values. Parse, import normalization, and export builders throw when their operation cannot proceed.

## Domain Types

Module: `src/domain/apiCanvas.ts`

### `JsonSchemaNode`

```ts
type JsonSchemaNode = boolean | {
  $id?: string
  $ref?: string
  additionalProperties?: JsonSchemaNode
  default?: unknown
  description?: string
  enum?: readonly (string | number | boolean | null)[]
  example?: unknown
  format?: string
  items?: JsonSchemaNode
  properties?: Record<string, JsonSchemaNode>
  required?: readonly string[]
  title?: string
  type?: 'array' | 'boolean' | 'integer' | 'number' | 'object' | 'string'
}
```

Represents the JSON Schema subset that TypeScript callers manipulate directly. Runtime imports preserve unknown object keywords through the Zod catch-all even though structured TypeScript code does not receive named properties for them.

Boolean schemas are valid. Test presence with `schema !== undefined`, not truthiness.

### HTTP Types

| Export | Purpose |
| --- | --- |
| `ParameterLocation` | Union of `cookie`, `header`, `path`, and `query`. |
| `HttpParameter` | Stable `id`, name/location/description/required fields, and one optional schema source. Reused for response headers. |
| `MediaTypePayload` | Optional component ref, inline schema, and string example for one content media type. |
| `HttpBody` | Request description, required flag, and content map. |
| `HttpResponse` | Status string, required description, headers, and content map. |
| `HttpContract` | Method, path, operation metadata, parameters, optional body, and responses for one operation. |

`HttpContract.method` supports `delete`, `get`, `patch`, `post`, and `put`. `HttpResponse.status` remains a string so `default` and future pattern handling can coexist with explicit codes; semantic validation constrains current accepted values.

### Capability Types

| Export | Purpose and references |
| --- | --- |
| `UserRole` | Ordered API user/actor. |
| `UseCase` | Ordered outcome with `roleId -> UserRole.id`. |
| `Step` | Ordered capability action with `useCaseId -> UseCase.id` and `operationId -> Operation.id`. |
| `Operation` | Reusable capability with an optional `HttpContract`. |
| `SchemaComponent` | Stable ID, OpenAPI component name, and JSON Schema value. |
| `ApiCanvas` | Aggregate root containing metadata and every collection. |
| `CreateApiCanvasInput` | Required name plus optional description and version. |

### `createApiCanvas`

```ts
function createApiCanvas(input: CreateApiCanvasInput): ApiCanvas
```

Creates a new empty aggregate. It trims name/description/version, defaults a blank version to `0.1.0`, uses one current ISO timestamp for both date fields, and generates a UUID. It does not reject a blank name; call validation or enforce that input at the UI boundary.

### `sampleCanvas`

```ts
const sampleCanvas: ApiCanvas
```

Deterministic Commerce API teaching data used by first-run seeding and tests. Treat it as immutable. It demonstrates reused operations, contracted and uncontracted operations, parameters, success/failure responses, servers, tags, and schema refs.

## Domain Mutations

Module: `src/domain/mutations.ts`

All accepted mutations refresh `updatedAt`. Unless noted as a no-op, update/delete functions return a touched canvas even if the requested ID does not match; callers should use known IDs.

### Aggregate Operations

| Function | Contract |
| --- | --- |
| `duplicateApiCanvas(apiCanvas)` | Deep-copies top-level IDs and contract parameter/header IDs, rewrites domain references, suffixes name with `copy` and operation IDs with `Copy`, resets both timestamps. |
| `updateApiMetadata(apiCanvas, patch)` | Replaces name, description, version, servers, and tags as one complete metadata patch. |

### Roles

| Function | Contract |
| --- | --- |
| `createRole(apiCanvas)` | Appends `Role N` with next global role order. |
| `updateRole(apiCanvas, roleId, patch)` | Replaces name, description, and order on the matching role. |
| `deleteRole(apiCanvas, roleId)` | Removes the role, its use cases, and all steps in those use cases. |
| `mergeRole(apiCanvas, sourceRoleId, targetRoleId)` | Moves source use cases to target and removes source. Self/missing merge is an identity no-op. |

### Use Cases

| Function | Contract |
| --- | --- |
| `createUseCase(apiCanvas, roleId)` | Uses the supplied or first role, appends `Use case N`, and assigns next order within that role. No valid role means identity no-op. |
| `updateUseCase(apiCanvas, useCaseId, patch)` | Replaces title, description, role reference, and order. |
| `deleteUseCase(apiCanvas, useCaseId)` | Removes the use case and all steps under it. |

### Operations

| Function | Contract |
| --- | --- |
| `createOperation(apiCanvas)` | Appends uncontracted `Operation N`. |
| `updateOperation(apiCanvas, operationId, patch)` | Replaces operation name and description while preserving its contract. |
| `setOperationContract(apiCanvas, operationId, contract)` | Attaches/replaces a contract or removes it when `undefined`. |
| `deleteOperation(apiCanvas, operationId)` | Removes the operation and all steps that reference it. |
| `mergeOperation(apiCanvas, sourceOperationId, targetOperationId)` | Moves source steps to target and removes source. Target contract wins. Self/missing merge is an identity no-op. |

### Steps

| Function | Contract |
| --- | --- |
| `createStep(apiCanvas, useCaseId, operationId)` | Uses supplied or first parents, then appends `Step N` in that use case. Missing/unknown parent means identity no-op. |
| `updateStep(apiCanvas, stepId, patch)` | Replaces both references, title, input, success/failure narratives, and order. |
| `deleteStep(apiCanvas, stepId)` | Removes only the matching step. |

### Schema Components

| Function | Contract |
| --- | --- |
| `createSchemaComponent(apiCanvas)` | Appends `SchemaN` with an empty object schema. |
| `updateSchemaComponent(apiCanvas, schemaId, patch)` | Replaces name/schema. An actual name change rewrites exact dedicated contract refs. |
| `deleteSchemaComponent(apiCanvas, schemaId)` | Removes only the component; dangling refs are left for validation. |

`updateSchemaComponent` may touch twice internally during a rename, so only rely on `updatedAt` being fresh, not on an exact clock-call count.

### HTTP Factories

| Function | Result |
| --- | --- |
| `defaultContract(operationName)` | `GET`, derived kebab-case path, derived camel-case operation ID, operation name as summary, and one empty-content `200` response. Falls back to `/resource` and `operation`. |
| `createParameter(location)` | UUID, `${location}Param`, blank description, inline string schema, and required only for `path`. |
| `createResponse()` | Status `200`, description `Response description`, and empty headers/content. |

Factories return editable defaults. They do not check uniqueness against an existing canvas.

## Selectors

Module: `src/domain/selectors.ts`

### `CanvasRow`

Joined view model containing `stepId`, `step`, `useCase`, `role`, and optional `operation`. Operation is optional so an invalid or legacy unassigned operation can remain visible.

### `getCanvasRows`

```ts
function getCanvasRows(api: ApiCanvas): readonly CanvasRow[]
```

Sorts by role order, use-case order, and step order, then joins references. Omits a step when its use case or role cannot be resolved. Retains it with `operation: undefined` when only the operation is missing.

### `getOperationRows`

```ts
function getOperationRows(api: ApiCanvas): readonly CanvasRow[]
```

Starts from canvas rows and sorts by operation collection order, then role/use-case/step order. Missing operations appear last.

### `summarizeApi`

Returns numeric `contractCount`, `operationCount`, `roleCount`, `schemaCount`, `stepCount`, and `useCaseCount`. It does not validate the aggregate.

## Validation

Module: `src/domain/validation.ts`

### Types

```ts
type ValidationSeverity = 'error' | 'warning' | 'info'

interface ValidationIssue {
  readonly id: string
  readonly message: string
  readonly path: string
  readonly severity: ValidationSeverity
  readonly title?: string
}
```

Issue IDs combine severity, path, and message deterministically. `title` supplies friendly grouping context for selected warnings/info.

### `validateApiCanvas`

```ts
function validateApiCanvas(apiCanvas: ApiCanvas): readonly ValidationIssue[]
```

Returns every discovered semantic issue without throwing or modifying the canvas. Rules are cataloged in [DOMAIN_MODEL.md](DOMAIN_MODEL.md#validation-catalog).

### `summarizeIssues`

```ts
function summarizeIssues(issues: readonly ValidationIssue[]): {
  readonly errors: number
  readonly infos: number
  readonly warnings: number
}
```

Counts severities. Unknown severities cannot occur through the exported type.

## Persistence

### Database Module

Module: `src/db/database.ts`

| Export | Contract |
| --- | --- |
| `PreferenceRecord` | Readonly `{ id: string; value: string }` reserved preference record. |
| `ApiCapabilitiesDatabase` | Dexie subclass exposing typed `apiCanvases` and `preferences` tables; constructor installs version 1 and populate seeding. |
| `database` | Application-wide database instance named `api-capabilities-canvas`. |

Most code should import repository functions, not `database`. Direct table access is appropriate for database-specific tests and future transaction implementations.

### Repository Module

Module: `src/db/apiCanvasRepository.ts`

| Function | Return and behavior |
| --- | --- |
| `listApiCanvases()` | `Promise<readonly ApiCanvas[]>`; newest `updatedAt` first. |
| `getApiCanvasById(apiId)` | Promise resolving to the matching `ApiCanvas`, or `undefined`. |
| `createApiCanvasRecord(input)` | Creates through the domain factory, adds without overwrite, and returns the canvas. Duplicate primary key rejects. |
| `deleteApiCanvasRecord(apiId)` | Deletes by ID; missing ID resolves normally. |
| `saveApiCanvasRecord(apiCanvas)` | Puts the complete aggregate, inserting or replacing by ID. |
| `seedSampleApiCanvas()` | Transactionally adds `sampleCanvas` only if absent; returns whether insertion occurred. |
| `replaceApiCanvases(apiCanvases)` | Transactionally puts every supplied aggregate. Does not delete omitted records. |

Repository functions do not call semantic validation. UI import validates before the batch write; workspace editing permits incomplete state and reports it separately.

## JSON Interchange

### Schemas

Module: `src/features/interchange/schemas.ts`

| Export | Contract |
| --- | --- |
| `apiEnvelopeSchema` | Zod decoder for kind `api-capabilities-canvas/api`, schema version 1, metadata, and one canvas. |
| `workspaceEnvelopeSchema` | Decoder for kind `api-capabilities-canvas/workspace`, schema version 1, metadata, and canvas array. |
| `importEnvelopeSchema` | Union decoder selecting either envelope by literal kind. |
| `ImportedEnvelope` | Inferred TypeScript union from `importEnvelopeSchema`. |

Known JSON Schema keywords are typed recursively. Unknown JSON Schema object keywords are retained through `.catchall(z.unknown())`. Other application objects use normal Zod object behavior and do not promise unknown-field preservation.

### Serialization And Import

Module: `src/features/interchange/jsonInterchange.ts`

| Function | Contract |
| --- | --- |
| `serializeApiCanvas(apiCanvas)` | Pretty-printed version 1 single-API JSON with current export timestamp and app version `0.0.0`. |
| `serializeWorkspace(apiCanvases)` | Pretty-printed version 1 workspace JSON with all supplied canvases. |
| `parseImportedJson(text)` | `JSON.parse` plus Zod decode; throws syntax or `ZodError` failures. |
| `normalizeImportedApis(envelope, existingApis, replaceConflicts)` | Rejects duplicate imported IDs and semantic errors; keeps IDs when new/replacing, or deep-copies conflicts. |

`normalizeImportedApis` returns values ready for repository persistence but performs no write itself.

## External Exporters

### OpenAPI

Module: `src/features/export/openApi.ts`

`OpenApiDocument` models the generated OpenAPI 3.1 root: literal version, Info Object, optional servers/tags, paths, and component schemas. Path operation bodies use `Record<string, unknown>` because the application does not expose a complete general-purpose OpenAPI type system.

```ts
function buildOpenApiDocument(apiCanvas: ApiCanvas): OpenApiDocument
async function buildOpenApiYaml(apiCanvas: ApiCanvas): Promise<string>
```

Both validate relevant API metadata, operation, and schema errors first and throw a newline-joined `Error` when blocked. YAML dynamically imports `yaml` and serializes the same document returned by the JSON builder.

### Workbook

Module: `src/features/export/workbook.ts`

```ts
async function buildWorkbookBuffer(apiCanvas: ApiCanvas): Promise<ArrayBuffer>
```

Dynamically imports ExcelJS, builds the three documented sheets, and resolves to XLSX bytes. It does not run domain validation because the workbook intentionally represents incomplete capability work.

### Downloads

Module: `src/features/export/download.ts`

```ts
function downloadTextFile(fileName: string, contents: string, mimeType: string): void
function downloadBinaryFile(fileName: string, contents: BlobPart, mimeType: string): void
```

Text adds `charset=utf-8`; binary preserves the MIME type. Both create a hidden anchor and object URL, click synchronously, remove the anchor in `finally`, and revoke the URL in the next task.

These functions require a browser DOM. Keep document construction independently testable in Node/jsdom.

## Schema Builder

Module: `src/features/workspace/schemaBuilder.ts`

### `StructuredPropertyDraft`

One flat property row with stable ID, name, required flag, description, and one of six JSON Schema primitive/container type names.

### Functions

| Function | Contract |
| --- | --- |
| `schemaToStructuredProperties(schema)` | Returns `{ properties, supported }`. Rejects any form that cannot round-trip through structured mode. Supported row IDs are deterministic by property index. |
| `buildStructuredSchema(properties)` | Builds a flat object schema; trims names/descriptions, drops blank names, and includes only required rows with non-blank names. |
| `createStructuredProperty(name)` | Creates a UUID-backed optional string property row with blank description. The caller supplies a non-empty unique starting name. |

`supported: false` is a mode decision, not a schema-validation failure. The UI should retain and edit that value as raw JSON.

## React Components

### Application Views

| Export | Route/role |
| --- | --- |
| `ApiLibraryPage()` | Root library view. Reads live IndexedDB data and orchestrates canvas-level commands. |
| `ApiWorkspacePage()` | `/api/:apiId/:tab` composition root. Loads one canvas and owns tabs, history, autosave, validation, contracts, schemas, and exports. |

Neither component accepts props; both depend on router and database context available in the application tree.

### Capability Tabs

Module: `src/features/workspace/CanvasModelTabs.tsx`

`CanvasEditorTab`, `UsersTab`, and `OperationsTab` each accept:

```ts
{
  readonly apiCanvas: ApiCanvas
  readonly applyChange: (nextValue: ApiCanvas) => void
}
```

- `CanvasEditorTab` edits the business canvas and supports selecting or creating operations.
- `UsersTab` manages roles and role merging.
- `OperationsTab` presents steps regrouped around reusable operations and supports operation merging.

The components do not persist directly. The parent callback must integrate history and saving.

### `CreatableCombobox`

Module: `src/features/workspace/CreatableCombobox.tsx`

`ComboboxOption` is `{ readonly id: string; readonly label: string }`.

Props:

| Prop | Meaning |
| --- | --- |
| `ariaLabel` | Required accessible input name. |
| `autoFocus` | Optional initial input focus; defaults to false. |
| `options` | Existing values presented through a datalist. |
| `placeholder` | Optional input hint. |
| `value` | Current committed label. |
| `onCommit(optionId, value)` | Receives a matching option ID or `undefined` for new text, plus trimmed text. |
| `onEditingComplete(restoreFocus)` | Optional completion signal; true only for Enter/Escape keyboard completion. |

Blank/unchanged text does not call `onCommit`. Escape restores the controlled value. Matching uses locale comparison with accent sensitivity and otherwise ignores case.

## Application Entry Points

- `src/main.tsx` mounts React in `StrictMode`, installs `HashRouter`, and imports global CSS.
- `src/App.tsx` exports the default shell component, primary navigation, route definitions, and catch-all redirect.

These are composition entry points rather than reusable modules. Keep service construction and route-level orchestration here or in their owning feature pages, while domain behavior stays in exported pure modules.

## Failure Summary

| API family | Failure signal |
| --- | --- |
| Domain mutation | Returns next canvas; selected invalid commands return original canvas. |
| Selectors | Return partial/filtered view models defensively; do not throw for missing refs. |
| Validation | Returns issue values. |
| Dexie repository | Rejects its promise with the underlying storage error. |
| JSON parse/decode | Throws syntax or Zod error. |
| Import normalization | Throws `Error` for duplicate IDs or joined semantic errors. |
| OpenAPI build | Throws `Error` for relevant blocking validation issues. |
| Workbook build | Rejects for dynamic import or ExcelJS generation failure. |
| Download helper | DOM setup/click errors propagate after anchor cleanup; URL revocation remains scheduled. |
