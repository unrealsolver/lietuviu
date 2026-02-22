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
  const sourcePath = join(config.paths.inDir, sourceFile);
  const raw = JSON.parse(await readFile(sourcePath, "utf8")) as unknown;
  if (!isInputBank(raw)) {
    throw new Error(
      `Invalid bank schema in ${sourceFile}. Expected InputBank format.`,
    );
  }
  const bank = raw;
  const bankId = basename(sourceFile, extname(sourceFile));
  ensureProvidersAvailable(bank, config.plugins);

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

function isInputBank(raw: unknown): raw is InputBank {
  if (raw == null || typeof raw !== "object") {
    return false;
  }

  const bank = raw as InputBank;
  return (
    typeof bank.schemaVersion === "string" &&
    typeof bank.title === "string" &&
    typeof bank.sourceLanguage === "string" &&
    Array.isArray(bank.features) &&
    bank.features.every((feature) => {
      const candidate = feature as {
        id?: unknown;
        provider?: unknown;
        options?: unknown;
      };
      return (
        feature != null &&
        typeof feature === "object" &&
        (candidate.id === undefined || typeof candidate.id === "string") &&
        typeof candidate.provider === "string" &&
        typeof candidate.options === "object" &&
        candidate.options != null
      );
    }) &&
    Array.isArray(bank.data) &&
    bank.data.every((item) => typeof item === "string")
  );
}

function buildOutputBank(
  bank: InputBank,
  featureResults: Array<{
    featureId: string;
    provider: string;
    kind: string;
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
    schemaVersion: bank.schemaVersion,
    title: bank.title,
    description: bank.description,
    author: bank.author,
    sourceLanguage: bank.sourceLanguage,
    generatedAt: new Date().toISOString(),
    features: featureMeta.map((feature) => ({
      id: feature.id,
      type: feature.type,
      provider: feature.provider,
      version: feature.version,
    })),
    data: bank.data.map((input) => ({
      input,
      features: itemIndex.get(input) ?? {},
    })),
  };
}
