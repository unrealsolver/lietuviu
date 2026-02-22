# Processing Architecture Summary

## Goal

Keep `packages/databanks` as task definitions and make `packages/processing` responsible for:

- plugin execution
- replay/cache/log handling
- parallelism
- deterministic output generation

## Current Input Model

```ts
type InputBank = {
  schemaVersion: string;
  title: string;
  description?: string;
  author?: string;
  sourceLanguage: string;
  features: Array<{
    id?: string;
    group?: string;
    provider: string;
    options: Record<string, unknown>;
    maxRpm?: number;
  }>;
  data: string[];
};
```

Notes:

- `features[]` is intentionally slim.
- No feature `name/type/version/replay` in source input.
- Common feature fields (runtime/executor-owned):
  - `id?`: user-friendly feature id override
  - `group?`: optional collapse-group override
  - `provider`, `maxRpm`
- Plugin-specific configuration lives only under `feature.options` (plugin-owned, Zod-validated).
- Optional `feature.id` is allowed as a user override for readability/debugging.
- Runtime derives compact feature IDs for output when `feature.id` is absent: `<provider-lowercase-kebab>-<n>`.
- Feature IDs must be unique across the whole bank (custom/custom and custom/generated collisions hard-fail).

## Execution Model

- All active features run in parallel by default (feature-level parallelism).
- Each plugin can define its own item concurrency via `plugin.itemConcurrency`.
- Executor fallback concurrency is configured globally (`featureConcurrency` in runtime config).
- Error policy is explicit:
  - `FAIL`: hard fail on first item error.
  - `SKIP_ITEM`: skip failed item result from output.
- Progress bars render feature IDs (not provider names) so custom IDs are visible during execution.

### Collapse/Chain Execution (Initial Implementation)

Goal: allow multiple plugins of the same feature type to behave as a fallback chain (chain of responsibility), while preserving simple authoring in `databank.source.json`.

Decisions:

- `ERROR` vs `NO_RESULT` are different outcomes:
  - `ERROR`: real execution failure, handled by existing error policy (`FAIL` / `SKIP_ITEM`).
  - `NO_RESULT`: non-error miss (for example dictionary has no entry); executor should try the next plugin in chain.
- `NoResultError` is the plugin-facing sentinel for `NO_RESULT`.
- No `priority` field (too much complexity / footgun).
- `features[]` source model stays simple and user-write-friendly (plain list of plugins).
- New optional feature option for collapse grouping:
  - `group?: string` (common feature field override, not plugin `options`)
- Default collapse grouping:
  - by feature type + implicit group `"default"` per feature type
  - Example mental model: `TRANSLATION/default`, `PHONETICS/default`
- Chain order is the order of plugins in `features[]`.
- Multiple collapse groups may run in parallel (group-level parallelism), while each group processes fallbacks sequentially per item.
- Initial executor behavior is implemented for collapse-by-group fallback chains.

Output model (current v1):

- Keep current `databank.output.json` item feature map keyed by actual feature IDs (winner plugin IDs).
- Do not add repetitive per-item provenance field yet.
- Provenance can be inferred from the winning feature key + top-level `features[]` metadata.
- `databank.output.json` remains machine-oriented and debug-friendly; source databank remains author-friendly.

Consumer ergonomics:

- Add a small TS wrapper/view class around output databank (instead of overloading JSON format early).
- Wrapper can infer relations such as:
  - feature lookup by type/group
  - winner plugin per item
  - normalized accessors for translation/phonetics

## Plugin Contract

```ts
type Plugin<Opt = unknown, Out = unknown> = {
  kind: "TRANSLATION" | "PHONETICS" | "MORPHOLOGY";
  provider: string;
  version: string;
  itemConcurrency?: number;
  run(input: string, options: Opt, ctx: PluginCtx): Promise<Out>;
};

type PluginCtx = {
  signal?: AbortSignal;
  emitProgress?: (n: number) => void;
  callExternal: <T>(request: ExternalCallRequest) => Promise<T>;
};
```

## Replay/Log Design

Logs are global (cross-bank reuse), append-only JSONL.

`callExternal` supports semantic cache identity:

```ts
type ExternalCallRequest = {
  operation: string;
  input: string;
  request: unknown;
  cacheIdentity?: {
    schema?: string;
    value: Record<string, unknown>;
  };
};
```

Keying:

- Preferred: identity key from `{ provider, operation, cacheSchema, cacheIdentity.value }`.
- Fallback: legacy key from `{ featureId, operation, input, featureOptions }`.

This keeps replay stable when irrelevant request details change (timeouts, concurrency, headers, etc.).

## Plugin Option Validation

- Plugin options are owned by plugins.
- Zod schemas are canonical for option shapes.
- TS option types are inferred from Zod (`z.infer<typeof Schema>`).
- Unknown options are rejected (`.strict()`), and runtime preflight fails once before item processing starts.

Examples:

- `translategemma`: strict Zod schema + language tag validation embedded in Zod refinements.
- `vdu_kirciuoklis`: strict Zod schema for options (`mode`).

## API Call Log Record

```ts
type ApiCallLog = {
  key: string;
  ts: string;
  provider?: string;
  input: string;
  operation?: string;
  cacheSchema?: string;
  cacheIdentity?: Record<string, unknown>;
  status: "ok" | "error";
  request?: unknown;
  response?: unknown;
  error?: unknown;
  durationMs: number;
};
```

## Implemented Plugins

### `translategemma`

- Provider: `translategemma`
- Model default: `translategemma:12b`
- Semantic identity: `{ model, promptHash }`
- Output type:
  - compact (default): `string`
  - full: `{ translatedText, alternatives? }` via `options.outputMode = "full"`
- Small output normalization in plugin:
  - trims whitespace
  - replaces internal newlines with `", "`
  - strips trailing periods (`.`)

### `vdu_kirciuoklis`

- Provider: `vdu_kirciuoklis`
- Uses `text_accents` operation.
- Output is normalized and strict:

```ts
type PhoneticToken =
  | string
  | { accented: string; accentType: "MULTIPLE_MEANING" | "MULTIPLE_VARIANT" };
```

- Separators are removed.
- Unknown token types/accent types are treated as errors.
- Semantic identity: normalized input text for `text_accents`.

## Output Guarantees

- Output databank is generated only from successful feature outputs.
- Error payloads are not written into databank `data`.
- Missing plugin providers fail before processing starts (sanity check).
- Canonical feature-type outputs are defined at processing level (provider-independent):
  - `TRANSLATION` output shape
  - `PHONETICS` output shape

## Progress Rendering

- One line per active feature/plugin.
- Left: feature ID (custom or generated).
- Middle: bucketed bar mapped from item domain to terminal width.
- Right: `done/total` and percentage.
- State priority per bucket:
  - `ERROR` > `SKIPPED` > `PARTIAL_REPLAY` > `REPLAYED` > `PASSED`
- Symbols:
  - passed: `█`
  - replayed: `▞`
  - partial replay: `▞`
  - skipped: `▶`
  - error: `✖`
- Renders are throttled to max once per second.
