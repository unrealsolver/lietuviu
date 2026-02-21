export type FeatureKind = "TRANSLATION" | "PHONETICS" | "MORPHOLOGY";

export type ReplayPolicy = "LIVE" | "REPLAY_ONLY" | "REPLAY_THEN_LIVE";

export type Plugin<Opt = unknown, Out = unknown> = {
  kind: FeatureKind;
  provider: string;
  version: string;
  itemConcurrency?: number;
  validateOptions?: (options: Opt) => void;

  run(input: string, options: Opt, ctx: PluginCtx): Promise<Out>;
};

export type PluginFactory<GlobalConfig = void, Opt = unknown, Out = unknown> = (
  config: GlobalConfig,
) => Plugin<Opt, Out>;

export type ExternalCallRequest = {
  operation: string;
  input: string;
  request: unknown;
  cacheIdentity?: {
    schema?: string;
    value: Record<string, unknown>;
  };
};

export type PluginCtx = {
  signal?: AbortSignal;
  emitProgress?: (n: number) => void;
  callExternal: <TResponse = unknown>(
    request: ExternalCallRequest,
  ) => Promise<TResponse>;
};
