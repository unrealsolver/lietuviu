import type { LogStore } from "./logstore";
import type { FeatureConfig, InputBank } from "./models";
import type { Plugin, ReplayPolicy, ExternalCallRequest } from "./plugin";
import { createHash } from "node:crypto";

// Executor runs bank features against registered plugins and owns replay/cache behavior
// for external calls via LogStore. Plugins only describe call intent through ctx.callExternal.
export type FeatureRunResult = {
  featureId: string;
  provider: string;
  kind: Plugin["kind"];
  version: string;
  outputs: Array<{
    input: string;
    output?: unknown;
    error?: string;
  }>;
};

export type ExecuteBankResult = {
  bankTitle: string;
  featureResults: FeatureRunResult[];
};

export type ExecutorDependencies = {
  plugins: Plugin[];
  logStore: LogStore;
};

export type Executor = {
  executeBank(bank: InputBank): Promise<ExecuteBankResult>;
};

export type FeatureExecutionContext = {
  feature: FeatureConfig;
  plugin: Plugin;
  replay: ReplayPolicy;
  logStore: LogStore;
};

type ExternalHttpRequest = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  form?: Record<string, string>;
  timeoutMs?: number;
};

type ExecutorOptions = {
  defaultReplayPolicy?: ReplayPolicy;
  featureParallelism?: number;
  featureConcurrency?: number;
  errorPolicy?: "FAIL" | "SKIP_ITEM";
  onItemProgress?: (event: ItemProgressEvent) => void;
};

const DEFAULT_FEATURE_CONCURRENCY = 4;

export type ItemProgressEvent = {
  featureId: string;
  pluginName: string;
  total: number;
  index: number;
  done: number;
  outcome: "PASSED" | "REPLAYED" | "PARTIAL_REPLAY" | "SKIPPED" | "ERROR";
};

export function createExecutor(
  deps: ExecutorDependencies,
  options: ExecutorOptions = {},
): Executor {
  const defaultReplayPolicy = options.defaultReplayPolicy ?? "REPLAY_THEN_LIVE";
  const featureParallelism = options.featureParallelism;
  const defaultItemConcurrency =
    options.featureConcurrency ?? DEFAULT_FEATURE_CONCURRENCY;
  const errorPolicy = options.errorPolicy ?? "FAIL";
  const onItemProgress = options.onItemProgress;

  return {
    async executeBank(bank: InputBank): Promise<ExecuteBankResult> {
      const resolvedFeatureParallelism = Math.max(
        1,
        (featureParallelism ?? bank.features.length) || 1,
      );
      const featureIds = resolveFeatureIds(bank.features);

      // Execute all features concurrently by default; mapLimit preserves source order in results.
      const featureResults = await mapLimit(
        bank.features,
        resolvedFeatureParallelism,
        async (feature, featureIndex) => {
          const plugin = deps.plugins.find((candidate) => {
            return candidate.provider === feature.provider;
          });

          if (plugin == null) {
            throw new Error(
              `No plugin registered for provider=${feature.provider}`,
            );
          }

          const replay = defaultReplayPolicy;
          const featureId = featureIds[featureIndex];
          if (featureId == null) {
            throw new Error(
              `Unable to resolve feature id for provider=${feature.provider}`,
            );
          }
          let done = 0;
          const total = bank.data.length;
          const itemConcurrency = Math.max(
            1,
            plugin.itemConcurrency ?? defaultItemConcurrency,
          );

          // Process inputs with plugin-specific concurrency (or global default).
          const outputs = await mapLimit(
            bank.data,
            itemConcurrency,
            async (input, index) => {
              let replayHits = 0;
              let liveCalls = 0;
              try {
                const output = await plugin.run(input, feature.options, {
                  emitProgress: () => undefined,
                  callExternal: async <TResponse = unknown>(
                    request: ExternalCallRequest,
                  ) => {
                    const result = await callExternalWithReplay<TResponse>({
                      request,
                      replay,
                      provider: plugin.provider,
                      featureId,
                      featureOptions: feature.options,
                      logStore: deps.logStore,
                    });
                    if (result.source === "REPLAY") {
                      replayHits += 1;
                    } else {
                      liveCalls += 1;
                    }
                    return result.response;
                  },
                });
                done += 1;
                const outcome =
                  replayHits > 0 && liveCalls === 0
                    ? "REPLAYED"
                    : replayHits > 0 && liveCalls > 0
                      ? "PARTIAL_REPLAY"
                      : "PASSED";
                onItemProgress?.({
                  featureId,
                  pluginName: plugin.provider,
                  total,
                  index,
                  done,
                  outcome,
                });

                return {
                  input,
                  output,
                };
              } catch (error) {
                if (errorPolicy === "FAIL") {
                  done += 1;
                  onItemProgress?.({
                    featureId,
                    pluginName: plugin.provider,
                    total,
                    index,
                    done,
                    outcome: "ERROR",
                  });
                  throw new Error(
                    `Feature "${featureId}" failed for input "${input}": ${
                      error instanceof Error ? error.message : String(error)
                    }`,
                  );
                }
                done += 1;
                onItemProgress?.({
                  featureId,
                  pluginName: plugin.provider,
                  total,
                  index,
                  done,
                  outcome: "SKIPPED",
                });

                return {
                  input,
                  error: error instanceof Error ? error.message : String(error),
                };
              }
            },
          );

          return {
            featureId,
            provider: plugin.provider,
            kind: plugin.kind,
            version: plugin.version,
            outputs,
          } satisfies FeatureRunResult;
        },
      );

      return {
        bankTitle: bank.title,
        featureResults,
      };
    },
  };
}

async function callExternalWithReplay<TResponse>(params: {
  request: ExternalCallRequest;
  replay: ReplayPolicy;
  provider: string;
  featureId: string;
  featureOptions: Record<string, unknown>;
  logStore: LogStore;
}): Promise<{ response: TResponse; source: "REPLAY" | "LIVE" }> {
  const { request, replay, provider, featureId, featureOptions, logStore } =
    params;

  // Deterministic key allows replay/continue without re-calling external APIs.
  const identityKeyPayload =
    request.cacheIdentity == null
      ? null
      : {
          provider,
          operation: request.operation,
          cacheSchema: request.cacheIdentity.schema ?? "v1",
          identity: request.cacheIdentity.value,
        };

  const key =
    identityKeyPayload == null
      ? computeLegacyLogKey({
          featureId,
          input: request.input,
          operation: request.operation,
          featureOptions,
        })
      : computeIdentityLogKey(identityKeyPayload);

  // Replay-first paths return logged responses when available.
  if (replay !== "LIVE") {
    const cached = await logStore.get(key);
    if (cached != null) {
      if (cached.status === "ok") {
        return {
          response: cached.response as TResponse,
          source: "REPLAY",
        };
      }

      if (replay === "REPLAY_ONLY") {
        throw new Error(`Replay error for key=${key}`);
      }
    } else if (replay === "REPLAY_ONLY") {
      throw new Error(`Replay miss for key=${key}`);
    }
  }

  const startedAt = Date.now();

  try {
    // Live call path: execute request and persist a raw external-call record.
    const response = await performExternalCall<TResponse>(request.request);

    await logStore.put({
      key,
      ts: new Date().toISOString(),
      provider,
      input: request.input,
      operation: request.operation,
      cacheSchema: identityKeyPayload?.cacheSchema,
      cacheIdentity: identityKeyPayload?.identity,
      status: "ok",
      request: request.request,
      response,
      durationMs: Date.now() - startedAt,
    });

    return {
      response,
      source: "LIVE",
    };
  } catch (error) {
    // Errors are also logged so REPLAY_ONLY can reproduce failures deterministically.
    await logStore.put({
      key,
      ts: new Date().toISOString(),
      provider,
      input: request.input,
      operation: request.operation,
      cacheSchema: identityKeyPayload?.cacheSchema,
      cacheIdentity: identityKeyPayload?.identity,
      status: "error",
      request: request.request,
      error: serializeError(error),
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}

async function performExternalCall<TResponse>(
  request: unknown,
): Promise<TResponse> {
  if (!isExternalHttpRequest(request)) {
    throw new Error("Unsupported external request format");
  }

  const hasForm = request.form != null;
  const payload = hasForm
    ? toFormData(request.form ?? {})
    : request.body == null
      ? undefined
      : JSON.stringify(request.body);

  const res = await fetch(request.url, {
    method: request.method ?? "POST",
    headers: hasForm ? undefined : request.headers,
    body: payload,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(
      `External call failed: ${res.status} ${res.statusText} ${errBody}`.trim(),
    );
  }

  return (await res.json()) as TResponse;
}

function toFormData(form: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(form)) {
    data.append(key, value);
  }
  return data;
}

function resolveFeatureIds(features: FeatureConfig[]): string[] {
  const counters = new Map<string, number>();
  return features.map((feature) => {
    const prefix = toIdPrefix(feature.provider);
    const n = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, n);
    return `${prefix}-${n}`;
  });
}

function toIdPrefix(provider: string): string {
  return provider
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function computeLegacyLogKey(params: {
  featureId: string;
  operation: string;
  input: string;
  featureOptions: Record<string, unknown>;
}): string {
  return shortHash(
    stableJson({
      featureId: params.featureId,
      operation: params.operation,
      options: params.featureOptions,
      input: params.input,
    }),
  );
}

function computeIdentityLogKey(payload: {
  provider: string;
  operation: string;
  cacheSchema: string;
  identity: Record<string, unknown>;
}): string {
  return shortHash(stableJson(payload));
}

function shortHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function stableJson(value: unknown): string {
  if (value == null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(obj[key])}`).join(",")}}`;
}

function isExternalHttpRequest(
  request: unknown,
): request is ExternalHttpRequest {
  if (request == null || typeof request !== "object") {
    return false;
  }

  const maybe = request as Partial<ExternalHttpRequest>;
  return typeof maybe.url === "string";
}

async function mapLimit<TIn, TOut>(
  items: TIn[],
  limit: number,
  mapper: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
  const result = new Array<TOut>(items.length);
  let cursor = 0;

  const workers = new Array(Math.max(1, limit)).fill(0).map(async () => {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= items.length) {
        return;
      }
      const item = items[current];
      if (item === undefined) {
        return;
      }
      result[current] = await mapper(item, current);
    }
  });

  await Promise.all(workers);
  return result;
}

function serializeError(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return error;
}
