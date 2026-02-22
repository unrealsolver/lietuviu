import type { LogStore } from "./logstore";
import type { FeatureConfig, InputBank } from "./models";
import {
  type Plugin,
  type ReplayPolicy,
  type ExternalCallRequest,
  isNoResultError,
} from "./plugin";
import { createHash } from "node:crypto";

// Executor runs bank features against registered plugins and owns replay/cache behavior
// for external calls via LogStore. Plugins only describe call intent through ctx.callExternal.
export type FeatureRunResult = {
  featureId: string;
  provider: string;
  kind: Plugin["kind"];
  group?: string;
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

type ResolvedFeature = {
  feature: FeatureConfig;
  plugin: Plugin;
  featureId: string;
  featureIndex: number;
  collapseGroupKey: string;
};

type FeatureGroup = {
  key: string;
  members: ResolvedFeature[];
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
      const resolvedFeatures = bank.features.map((feature, featureIndex) => {
        const plugin = deps.plugins.find((candidate) => {
          return candidate.provider === feature.provider;
        });
        if (plugin == null) {
          throw new Error(
            `No plugin registered for provider=${feature.provider}`,
          );
        }
        const featureId = featureIds[featureIndex];
        if (featureId == null) {
          throw new Error(
            `Unable to resolve feature id for provider=${feature.provider}`,
          );
        }
        return {
          feature,
          plugin,
          featureId,
          featureIndex,
          collapseGroupKey: resolveCollapseGroupKey(plugin.kind, feature.group),
        } satisfies ResolvedFeature;
      });
      const groups = groupResolvedFeatures(resolvedFeatures);

      // Execute collapse groups concurrently by default. Within a group, plugins form a fallback chain.
      const groupedResults = await mapLimit(
        groups,
        resolvedFeatureParallelism,
        async (group) => {
          return executeFeatureGroup({
            group,
            bankData: bank.data,
            replay: defaultReplayPolicy,
            logStore: deps.logStore,
            defaultItemConcurrency,
            errorPolicy,
            onItemProgress,
          });
        },
      );

      const featureResults = groupedResults.flat().sort((a, b) => {
        const aIndex =
          resolvedFeatures.find((f) => f.featureId === a.featureId)
            ?.featureIndex ?? 0;
        const bIndex =
          resolvedFeatures.find((f) => f.featureId === b.featureId)
            ?.featureIndex ?? 0;
        return aIndex - bIndex;
      });

      return {
        bankTitle: bank.title,
        featureResults,
      };
    },
  };
}

async function executeFeatureGroup(params: {
  group: FeatureGroup;
  bankData: string[];
  replay: ReplayPolicy;
  logStore: LogStore;
  defaultItemConcurrency: number;
  errorPolicy: "FAIL" | "SKIP_ITEM";
  onItemProgress?: (event: ItemProgressEvent) => void;
}): Promise<FeatureRunResult[]> {
  const {
    group,
    bankData,
    replay,
    logStore,
    defaultItemConcurrency,
    errorPolicy,
    onItemProgress,
  } = params;

  const outputsByFeatureId = new Map<
    string,
    Array<{ input: string; output?: unknown; error?: string }>
  >(
    group.members.map((member) => [
      member.featureId,
      new Array(bankData.length) as Array<{
        input: string;
        output?: unknown;
        error?: string;
      }>,
    ]),
  );
  const doneByFeatureId = new Map<string, number>(
    group.members.map((member) => [member.featureId, 0]),
  );
  const groupItemConcurrency = Math.max(
    1,
    ...group.members.map((member) => {
      return member.plugin.itemConcurrency ?? defaultItemConcurrency;
    }),
  );

  await mapLimit(bankData, groupItemConcurrency, async (input, index) => {
    let chainResolved = false;
    let chainErrored = false;

    for (const member of group.members) {
      const target = outputsByFeatureId.get(member.featureId);
      if (target == null) {
        throw new Error(
          `Missing feature output buffer for ${member.featureId}`,
        );
      }

      if (chainResolved || chainErrored) {
        target[index] = { input };
        emitProgressForFeature(
          member,
          doneByFeatureId,
          bankData.length,
          index,
          "SKIPPED",
          onItemProgress,
        );
        continue;
      }

      let replayHits = 0;
      let liveCalls = 0;
      try {
        const output = await member.plugin.run(input, member.feature.options, {
          emitProgress: () => undefined,
          callExternal: async <TResponse = unknown>(
            request: ExternalCallRequest,
          ) => {
            const result = await callExternalWithReplay<TResponse>({
              request,
              replay,
              provider: member.plugin.provider,
              featureId: member.featureId,
              featureOptions: member.feature.options,
              logStore,
            });
            if (result.source === "REPLAY") {
              replayHits += 1;
            } else {
              liveCalls += 1;
            }
            return result.response;
          },
        });

        target[index] = { input, output };
        chainResolved = true;
        emitProgressForFeature(
          member,
          doneByFeatureId,
          bankData.length,
          index,
          replayHits > 0 && liveCalls === 0
            ? "REPLAYED"
            : replayHits > 0 && liveCalls > 0
              ? "PARTIAL_REPLAY"
              : "PASSED",
          onItemProgress,
        );
      } catch (error) {
        if (isNoResultError(error)) {
          target[index] = { input };
          emitProgressForFeature(
            member,
            doneByFeatureId,
            bankData.length,
            index,
            "SKIPPED",
            onItemProgress,
          );
          continue;
        }

        if (errorPolicy === "FAIL") {
          emitProgressForFeature(
            member,
            doneByFeatureId,
            bankData.length,
            index,
            "ERROR",
            onItemProgress,
          );
          throw new Error(
            `Feature "${member.featureId}" failed for input "${input}": ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }

        target[index] = {
          input,
          error: error instanceof Error ? error.message : String(error),
        };
        chainErrored = true;
        emitProgressForFeature(
          member,
          doneByFeatureId,
          bankData.length,
          index,
          "SKIPPED",
          onItemProgress,
        );
      }
    }
  });

  return group.members.map((member) => {
    const outputs = outputsByFeatureId.get(member.featureId);
    if (outputs == null) {
      throw new Error(`Missing feature outputs for ${member.featureId}`);
    }
    return {
      featureId: member.featureId,
      provider: member.plugin.provider,
      kind: member.plugin.kind,
      group: normalizeFeatureGroup(member.feature.group),
      version: member.plugin.version,
      outputs,
    } satisfies FeatureRunResult;
  });
}

function emitProgressForFeature(
  member: ResolvedFeature,
  doneByFeatureId: Map<string, number>,
  total: number,
  index: number,
  outcome: ItemProgressEvent["outcome"],
  onItemProgress?: (event: ItemProgressEvent) => void,
): void {
  const done = (doneByFeatureId.get(member.featureId) ?? 0) + 1;
  doneByFeatureId.set(member.featureId, done);
  onItemProgress?.({
    featureId: member.featureId,
    pluginName: member.plugin.provider,
    total,
    index,
    done,
    outcome,
  });
}

function groupResolvedFeatures(features: ResolvedFeature[]): FeatureGroup[] {
  const groups = new Map<string, FeatureGroup>();
  for (const feature of features) {
    const existing = groups.get(feature.collapseGroupKey);
    if (existing == null) {
      groups.set(feature.collapseGroupKey, {
        key: feature.collapseGroupKey,
        members: [feature],
      });
      continue;
    }
    existing.members.push(feature);
  }
  return [...groups.values()];
}

function resolveCollapseGroupKey(
  kind: Plugin["kind"],
  groupOverride: string | undefined,
): string {
  const group = normalizeFeatureGroup(groupOverride) ?? "default";
  return `${kind}:${group}`;
}

function normalizeFeatureGroup(group: string | undefined): string | undefined {
  const rawGroup = group?.trim();
  return rawGroup != null && rawGroup.length > 0 ? rawGroup : undefined;
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
  const used = new Set<string>();
  return features.map((feature, index) => {
    const customId = feature.id?.trim();
    const nextId =
      customId && customId.length > 0
        ? customId
        : (() => {
            const prefix = toIdPrefix(feature.provider);
            const n = (counters.get(prefix) ?? 0) + 1;
            counters.set(prefix, n);
            return `${prefix}-${n}`;
          })();

    if (used.has(nextId)) {
      throw new Error(
        `Duplicate feature id "${nextId}" at feature index ${index}`,
      );
    }
    used.add(nextId);
    return nextId;
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
