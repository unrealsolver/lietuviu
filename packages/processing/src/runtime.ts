import { InputBankReader } from "./InputBankReader";
import {
  createBankLogStore,
  createExecutor,
  type InputBank,
  type Plugin,
  type ReplayPolicy,
} from "./integrations";
import { ProgressRenderer } from "./progress";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

// Runtime is the high-level orchestrator: load banks, run executor, and write output artifacts.
export type ProcessingRuntimeConfig = {
  /** Input and output directories for bank source files and generated results. */
  paths: {
    /** Directory with input bank JSON files (`*.json`). */
    inDir: string;
    /** Directory where generated banks and logs are written. */
    outDir: string;
  };
  /** Active plugin instances used to resolve and execute bank features by provider. */
  plugins: Plugin[];
  /** Global execution defaults. Feature-level values are resolved by executor behavior. */
  defaults?: {
    /** Replay policy for external calls when feature does not override behavior. */
    replayPolicy?: ReplayPolicy;
    /** Number of features processed in parallel. Defaults to number of active features. */
    featureParallelism?: number;
    /** Default item-level concurrency per plugin when plugin does not specify `itemConcurrency`. */
    featureConcurrency?: number;
    /** Error handling mode: fail whole job or skip failed items. */
    errorPolicy?: "FAIL" | "SKIP_ITEM";
  };
  /** Optional runtime hooks for console/log integrations. */
  hooks?: {
    /** Informational log hook (defaults to `console.log`). */
    onInfo?: (message: string) => void;
    /** Warning log hook (reserved for optional warnings). */
    onWarn?: (message: string) => void;
  };
};

export async function runProcessing(
  config: ProcessingRuntimeConfig,
): Promise<number> {
  const info = config.hooks?.onInfo ?? console.log;
  const progress = new ProgressRenderer();

  await mkdir(config.paths.outDir, { recursive: true });

  const sourceFiles = (await readdir(config.paths.inDir))
    .filter((file) => extname(file).toLowerCase() === ".json")
    .sort();

  // Process each bank source independently so logs/output stay bank-scoped.
  for (const sourceFile of sourceFiles) {
    await processBankFile(sourceFile, config, info, progress);
  }

  progress.stop();
  return 0;
}

async function processBankFile(
  sourceFile: string,
  config: ProcessingRuntimeConfig,
  info: (message: string) => void,
  progress: ProgressRenderer,
): Promise<void> {
  type RawInputBank = Omit<InputBank, "id" | "version"> & {
    id?: string;
    version?: string;
  };

  const sourcePath = join(config.paths.inDir, sourceFile);
  const raw = JSON.parse(await readFile(sourcePath, "utf8")) as unknown;
  const bankValidationError = getInputBankValidationError(raw);
  if (bankValidationError != null) {
    throw new Error(
      `Invalid bank schema in ${sourceFile}: ${bankValidationError}`,
    );
  }
  const parsedBank = raw as RawInputBank;
  const bankId = basename(sourceFile, extname(sourceFile));
  const bank: InputBank = {
    ...parsedBank,
    id: parsedBank.id ?? bankId,
    version: parsedBank.version ?? "0.0.0",
  };
  ensureProvidersAvailable(bank, config.plugins);
  initializeProgressRows(bank, config.plugins, progress);

  // Each bank gets its own log namespace, enabling replay/continue per bank.
  const logStore = await createBankLogStore(
    join(config.paths.outDir, "logs", bankId),
  );
  const executor = createExecutor(
    {
      plugins: config.plugins,
      logStore,
    },
    {
      defaultReplayPolicy: config.defaults?.replayPolicy,
      featureParallelism: config.defaults?.featureParallelism,
      featureConcurrency: config.defaults?.featureConcurrency,
      errorPolicy: config.defaults?.errorPolicy,
      onItemProgress: (event) => {
        progress.update(event);
      },
    },
  );

  const result = await executor.executeBank(bank);
  const output = buildOutputBank(bank, result.featureResults);
  const outputPath = join(config.paths.outDir, `${bankId}.bank.json`);
  await writeFile(outputPath, JSON.stringify(output, null, 2));
  info(`[${bankId}] Done: ${outputPath}`);
}

function initializeProgressRows(
  bank: InputBank,
  plugins: Plugin[],
  progress: ProgressRenderer,
): void {
  const bankReader = new InputBankReader(bank);
  const pluginByProvider = new Map(
    plugins.map((plugin) => [plugin.provider, plugin]),
  );
  const total = bankReader.getItemCount();

  progress.initialize(
    bankReader.getResolvedFeatures().map((feature) => {
      const plugin = pluginByProvider.get(feature.provider);
      const kind = plugin?.kind ?? "?";
      const sectionLabel = `${kind} (${feature.group})`;
      return {
        featureId: feature.featureId,
        featureOrder: feature.featureOrder,
        label: feature.featureId,
        sectionKey: `${kind}:${feature.group}`,
        sectionLabel,
        total,
      };
    }),
  );
}

function ensureProvidersAvailable(bank: InputBank, plugins: Plugin[]): void {
  const registered = new Set(plugins.map((plugin) => plugin.provider));
  const missing = [
    ...new Set(bank.features.map((feature) => feature.provider)),
  ].filter((provider) => {
    return !registered.has(provider);
  });

  if (missing.length > 0) {
    throw new Error(`Missing plugins for providers: ${missing.join(", ")}`);
  }

  const pluginByProvider = new Map(
    plugins.map((plugin) => [plugin.provider, plugin]),
  );
  for (let i = 0; i < bank.features.length; i += 1) {
    const feature = bank.features[i];
    const plugin = pluginByProvider.get(feature.provider);
    if (plugin?.validateOptions == null) {
      continue;
    }

    try {
      plugin.validateOptions(feature.options as never);
    } catch (error) {
      throw new Error(
        `Invalid options for provider="${feature.provider}" at feature index ${i}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

function getInputBankValidationError(raw: unknown): string | null {
  if (raw == null || typeof raw !== "object") {
    return "root must be an object";
  }

  const bank = raw as Record<string, unknown>;
  if (typeof bank.schemaVersion !== "string") {
    return "schemaVersion must be a string";
  }
  if (bank.id !== undefined && typeof bank.id !== "string") {
    return "id must be a string when provided";
  }
  if (bank.version !== undefined && typeof bank.version !== "string") {
    return "version must be a string when provided";
  }
  if (typeof bank.title !== "string") {
    return "title must be a string";
  }
  if (typeof bank.sourceLanguage !== "string") {
    return "sourceLanguage must be a string";
  }
  if (!Array.isArray(bank.features)) {
    return "features must be an array";
  }
  for (let i = 0; i < bank.features.length; i += 1) {
    const feature = bank.features[i];
    if (feature == null || typeof feature !== "object") {
      return `features[${i}] must be an object`;
    }
    const candidate = feature as {
      id?: unknown;
      group?: unknown;
      provider?: unknown;
      options?: unknown;
    };
    if (candidate.id !== undefined && typeof candidate.id !== "string") {
      return `features[${i}].id must be a string when provided`;
    }
    if (candidate.group !== undefined && typeof candidate.group !== "string") {
      return `features[${i}].group must be a string when provided`;
    }
    if (typeof candidate.provider !== "string") {
      return `features[${i}].provider must be a string`;
    }
    if (candidate.options == null || typeof candidate.options !== "object") {
      return `features[${i}].options must be an object`;
    }
  }
  if (!Array.isArray(bank.data)) {
    return "data must be an array";
  }
  for (let i = 0; i < bank.data.length; i += 1) {
    if (typeof bank.data[i] !== "string") {
      return `data[${i}] must be a string`;
    }
  }
  return null;
}

function buildOutputBank(
  bank: InputBank,
  featureResults: Array<{
    featureId: string;
    provider: string;
    kind: string;
    group?: string;
    version: string;
    outputs: Array<{ input: string; output?: unknown; error?: string }>;
  }>,
) {
  // Output is assembled only from successful feature outputs.
  const itemIndex = new Map<string, Record<string, unknown>>();
  const featureMeta = featureResults.map((result) => {
    return {
      id: result.featureId,
      type: result.kind,
      group: result.group,
      provider: result.provider,
      version: result.version,
      outputs: result.outputs,
    };
  });

  for (const feature of featureMeta) {
    for (const item of feature.outputs) {
      if (item.error != null || item.output === undefined) {
        continue;
      }
      const current = itemIndex.get(item.input) ?? {};
      current[feature.id] = {
        output: item.output,
      };
      itemIndex.set(item.input, current);
    }
  }

  return {
    id: bank.id,
    version: bank.version,
    schemaVersion: bank.schemaVersion,
    title: bank.title,
    description: bank.description,
    author: bank.author,
    sourceLanguage: bank.sourceLanguage,
    generatedAt: new Date().toISOString(),
    features: featureMeta.map((feature) => ({
      id: feature.id,
      type: feature.type,
      group: feature.group,
      provider: feature.provider,
      version: feature.version,
    })),
    data: bank.data.map((input) => ({
      input,
      features: itemIndex.get(input) ?? {},
    })),
  };
}
