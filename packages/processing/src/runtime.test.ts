import type { Plugin } from "./integrations";
import { runProcessing } from "./runtime";
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

function resolveFeatureId(provider: string, index: number): string {
  const prefix = provider
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${prefix}-${index + 1}`;
}

function resolveLogKey(params: {
  featureId: string;
  operation: string;
  options: Record<string, unknown>;
  input: string;
}): string {
  return createHash("sha256")
    .update(
      stableJson({
        featureId: params.featureId,
        operation: params.operation,
        options: params.options,
        input: params.input,
      }),
    )
    .digest("hex");
}

describe("runtime output", () => {
  test("fails before processing when required provider plugin is missing", async () => {
    const baseDir = await mkdtemp(
      join(tmpdir(), "ltk-runtime-missing-plugin-"),
    );
    const inDir = join(baseDir, "sources");
    const outDir = join(baseDir, "dist");
    await mkdir(inDir, { recursive: true });

    const bank = {
      schemaVersion: "1.0.0",
      title: "Missing Plugin Bank",
      sourceLanguage: "lit",
      features: [
        {
          provider: "provider-not-registered",
          options: {},
        },
      ],
      data: ["ačiū"],
    };
    await writeFile(join(inDir, "missing.json"), JSON.stringify(bank, null, 2));

    await expect(
      runProcessing({
        paths: { inDir, outDir },
        plugins: [],
        defaults: {
          errorPolicy: "FAIL",
        },
      }),
    ).rejects.toThrow("Missing plugins for providers: provider-not-registered");
  });

  test("fails preflight once when plugin option validation fails", async () => {
    const baseDir = await mkdtemp(
      join(tmpdir(), "ltk-runtime-invalid-options-"),
    );
    const inDir = join(baseDir, "sources");
    const outDir = join(baseDir, "dist");
    await mkdir(inDir, { recursive: true });

    const bank = {
      schemaVersion: "1.0.0",
      title: "Invalid Options Bank",
      sourceLanguage: "lit",
      features: [
        {
          provider: "validator-plugin",
          options: {
            bad: true,
          },
        },
      ],
      data: ["a", "b", "c"],
    };
    await writeFile(
      join(inDir, "invalid-options.json"),
      JSON.stringify(bank, null, 2),
    );

    let runCalls = 0;
    const plugin: Plugin = {
      kind: "TRANSLATION",
      provider: "validator-plugin",
      version: "1.0.0",
      validateOptions: () => {
        throw new Error("bad options");
      },
      async run() {
        runCalls += 1;
        return "x";
      },
    };

    await expect(
      runProcessing({
        paths: { inDir, outDir },
        plugins: [plugin],
      }),
    ).rejects.toThrow('Invalid options for provider="validator-plugin"');

    expect(runCalls).toBe(0);
  });

  test("includes plugin metadata and does not leak error payloads into databank", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "ltk-runtime-shape-"));
    const inDir = join(baseDir, "sources");
    const outDir = join(baseDir, "dist");
    await mkdir(inDir, { recursive: true });

    const bank = {
      schemaVersion: "1.0.0",
      title: "Test Bank",
      sourceLanguage: "lit",
      features: [
        {
          provider: "stub-shape",
          options: {
            variant: "default",
          },
        },
      ],
      data: ["ok", "bad"],
    };
    await writeFile(join(inDir, "shape.json"), JSON.stringify(bank, null, 2));

    const plugin: Plugin = {
      kind: "TRANSLATION",
      provider: "stub-shape",
      version: "9.9.9",
      async run(input: string): Promise<unknown> {
        if (input === "bad") {
          throw new Error("boom");
        }
        return { translatedText: input.toUpperCase() };
      },
    };

    await runProcessing({
      paths: { inDir, outDir },
      plugins: [plugin],
      defaults: {
        errorPolicy: "SKIP_ITEM",
        replayPolicy: "LIVE",
        featureConcurrency: 1,
      },
    });

    const out = JSON.parse(
      await readFile(join(outDir, "shape.bank.json"), "utf8"),
    ) as {
      features: Array<{
        id: string;
        type: string;
        provider: string;
        version: string;
      }>;
      data: Array<{
        input: string;
        features: Record<string, { output?: unknown; error?: unknown }>;
      }>;
    };

    expect(out.features).toHaveLength(1);
    expect(out.features[0].type).toBe("TRANSLATION");
    expect(out.features[0].provider).toBe("stub-shape");
    expect(out.features[0].version).toBe("9.9.9");
    expect(typeof out.features[0].id).toBe("string");

    const featureId = out.features[0].id;
    const okItem = out.data.find((item) => item.input === "ok");
    const badItem = out.data.find((item) => item.input === "bad");

    expect(okItem?.features[featureId]?.output).toEqual({
      translatedText: "OK",
    });
    expect(badItem?.features[featureId]).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain('"error"');
  });

  test("uses custom feature id override in output bank", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "ltk-runtime-custom-id-"));
    const inDir = join(baseDir, "sources");
    const outDir = join(baseDir, "dist");
    await mkdir(inDir, { recursive: true });

    const bank = {
      schemaVersion: "1.0.0",
      title: "Custom Id Bank",
      sourceLanguage: "lit",
      features: [
        {
          id: "translate-lit-rus-manual",
          provider: "stub-shape",
          options: {},
        },
      ],
      data: ["ačiū"],
    };
    await writeFile(
      join(inDir, "custom-id.json"),
      JSON.stringify(bank, null, 2),
    );

    const plugin: Plugin = {
      kind: "TRANSLATION",
      provider: "stub-shape",
      version: "1.0.0",
      async run(input: string) {
        return input.toUpperCase();
      },
    };

    await runProcessing({
      paths: { inDir, outDir },
      plugins: [plugin],
      defaults: { replayPolicy: "LIVE" },
    });

    const out = JSON.parse(
      await readFile(join(outDir, "custom-id.bank.json"), "utf8"),
    ) as {
      features: Array<{ id: string }>;
      data: Array<{
        input: string;
        features: Record<string, { output: unknown }>;
      }>;
    };

    expect(out.features[0]?.id).toBe("translate-lit-rus-manual");
    expect(out.data[0]?.features["translate-lit-rus-manual"]?.output).toBe(
      "AČIŪ",
    );
  });

  test("fails on duplicate custom feature ids", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "ltk-runtime-dup-id-"));
    const inDir = join(baseDir, "sources");
    const outDir = join(baseDir, "dist");
    await mkdir(inDir, { recursive: true });

    const bank = {
      schemaVersion: "1.0.0",
      title: "Duplicate Id Bank",
      sourceLanguage: "lit",
      features: [
        {
          id: "same-id",
          provider: "stub-shape",
          options: {},
        },
        {
          id: "same-id",
          provider: "stub-shape",
          options: {},
        },
      ],
      data: ["ačiū"],
    };
    await writeFile(join(inDir, "dup-id.json"), JSON.stringify(bank, null, 2));

    let runCalls = 0;
    const plugin: Plugin = {
      kind: "TRANSLATION",
      provider: "stub-shape",
      version: "1.0.0",
      async run() {
        runCalls += 1;
        return "x";
      },
    };

    await expect(
      runProcessing({
        paths: { inDir, outDir },
        plugins: [plugin],
      }),
    ).rejects.toThrow('Duplicate feature id "same-id"');

    expect(runCalls).toBe(0);
  });

  test("replay-only with fixed logs produces stable golden output", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "ltk-runtime-golden-"));
    const inDir = join(baseDir, "sources");
    const outDir = join(baseDir, "dist");
    await mkdir(inDir, { recursive: true });

    const featureOptions = { targetLanguage: "rus" } as Record<string, unknown>;
    const bank = {
      schemaVersion: "1.0.0",
      title: "Golden Bank",
      sourceLanguage: "lit",
      features: [
        {
          provider: "replay-stub",
          options: featureOptions,
        },
      ],
      data: ["ačiū", "labas"],
    };
    await writeFile(join(inDir, "golden.json"), JSON.stringify(bank, null, 2));

    const featureId = resolveFeatureId("replay-stub", 0);
    const logDir = join(outDir, "logs", "golden");
    await mkdir(logDir, { recursive: true });

    const records = [
      {
        input: "ačiū",
        translated: "спасибо",
      },
      {
        input: "labas",
        translated: "привет",
      },
    ].map((item) => {
      const operation = "replay.translate";
      const request = {
        url: "http://127.0.0.1:65535/never",
        method: "POST",
        body: {
          input: item.input,
          targetLanguage: "rus",
        },
      };
      return {
        key: resolveLogKey({
          featureId,
          operation,
          options: featureOptions,
          input: item.input,
        }),
        ts: "2026-02-20T00:00:00.000Z",
        input: item.input,
        operation,
        status: "ok" as const,
        request,
        response: {
          translatedText: item.translated,
        },
        durationMs: 1,
      };
    });

    await writeFile(
      join(logDir, "api-calls.log.jsonl"),
      `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
    );

    const plugin: Plugin = {
      kind: "TRANSLATION",
      provider: "replay-stub",
      version: "1.0.0",
      async run(input: string, options: unknown, ctx): Promise<unknown> {
        const result = await ctx.callExternal<{ translatedText: string }>({
          operation: "replay.translate",
          input,
          request: {
            url: "http://127.0.0.1:65535/never",
            method: "POST",
            body: {
              input,
              targetLanguage: (options as { targetLanguage: string })
                .targetLanguage,
            },
          },
        });
        return result;
      },
    };

    await runProcessing({
      paths: { inDir, outDir },
      plugins: [plugin],
      defaults: {
        replayPolicy: "REPLAY_ONLY",
        errorPolicy: "FAIL",
        featureConcurrency: 1,
      },
    });

    const out = JSON.parse(
      await readFile(join(outDir, "golden.bank.json"), "utf8"),
    ) as Record<string, unknown>;
    out.generatedAt = "<timestamp>";

    const expected = JSON.parse(
      await readFile(
        join(import.meta.dir, "__fixtures__", "golden.bank.expected.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;

    expect(out).toEqual(expected);
  });
});
