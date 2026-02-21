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
    provider: string;
    options: Record<string, unknown>;
    maxRpm?: number;
  }>;
  data: string[];
};
```

Notes:

- `features[]` is intentionally slim.
- No feature `id/name/type/version/replay` in source input.
- Runtime derives compact feature IDs for output: `<provider-lowercase-kebab>-<n>`.

## Execution Model

- All active features run in parallel by default (feature-level parallelism).
- Each plugin can define its own item concurrency via `plugin.itemConcurrency`.
- Executor fallback concurrency is configured globally (`featureConcurrency` in runtime config).
- Error policy is explicit:
  - `FAIL`: hard fail on first item error.
  - `SKIP_ITEM`: skip failed item result from output.

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

## Progress Rendering

- One line per active feature/plugin.
- Left: plugin name.
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
