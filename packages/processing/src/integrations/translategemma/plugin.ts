import type { TranslationOutput } from "../models";
import type { Plugin } from "../plugin";
import { renderPrompt, sha256, validateLanguageTag } from "./utils";
import { z } from "zod";

export type TranslateGemmaOutput = TranslationOutput;

export type TranslateGemmaPluginConfig = {
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  itemConcurrency?: number;
};

type OllamaGenerateResponse = {
  response: string;
};

const DEFAULT_MODEL = "translategemma:12b";
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const OLLAMA_GENERATE_OPERATION = "ollama.generate";
const DEFAULT_TIMEOUT_MS = 60_000;

export const TranslateGemmaOptionsSchema = z
  .object({
    /** Tag such as lt-lt */
    sourceLanguage: z.string().superRefine(refineSourceLanguageTag),
    /** Tag such as ru-ru */
    targetLanguage: z.string().superRefine(refineTargetLanguageTag),
    /** Extra prompt. Added next to system plugin prompt */
    extraPrompt: z.string().optional(),
    alternatives: z.number().int().nonnegative().optional(),
    temperature: z.number().optional(),
    outputMode: z.enum(["compact", "full"]).optional(),
  })
  .strict();

export type TranslateGemmaOptions = z.infer<typeof TranslateGemmaOptionsSchema>;

export function translategemma(
  pluginConfig: TranslateGemmaPluginConfig = {},
): Plugin<TranslateGemmaOptions, TranslateGemmaOutput> {
  const baseUrl = pluginConfig.baseUrl ?? DEFAULT_OLLAMA_BASE_URL;
  const model = pluginConfig.model ?? DEFAULT_MODEL;
  const timeoutMs = pluginConfig.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const globalHeaders = pluginConfig.headers ?? {};

  return {
    kind: "TRANSLATION",
    provider: "translategemma",
    version: "0.1.1",
    itemConcurrency: pluginConfig.itemConcurrency,
    validateOptions(options: TranslateGemmaOptions): void {
      TranslateGemmaOptionsSchema.parse(options);
    },
    async run(
      input: string,
      options: TranslateGemmaOptions,
      ctx,
    ): Promise<TranslateGemmaOutput> {
      const prompt = renderPrompt({
        sourceLanguageTag: options.sourceLanguage,
        targetLanguageTag: options.targetLanguage,
        input,
        extraPrompt: options.extraPrompt,
      });

      const request = {
        url: `${baseUrl}/api/generate`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...globalHeaders,
        },
        body: {
          model,
          prompt,
          stream: false,
          options: {
            temperature: options.temperature ?? 0,
          },
        },
        timeoutMs,
      };

      const body = await ctx.callExternal<OllamaGenerateResponse>({
        operation: OLLAMA_GENERATE_OPERATION,
        input,
        cacheIdentity: {
          schema: "v1",
          value: {
            model,
            promptHash: sha256(prompt),
          },
        },
        request,
      });
      const translatedText = normalizeTranslationText(body.response);

      if (translatedText.length === 0) {
        throw new Error("Ollama returned an empty translation");
      }

      ctx.emitProgress?.(1);

      if (options.outputMode === "full") {
        return {
          translatedText,
          alternatives: [],
        };
      }

      return translatedText;
    },
  };
}

function normalizeTranslationText(value: string): string {
  return value
    .trim()
    .replace(/\r?\n+/gu, ", ")
    .replace(/\.+$/u, "");
}

function refineSourceLanguageTag(value: string, ctx: z.RefinementCtx): void {
  refineLanguageTag(value, "sourceLanguage", ctx);
}

function refineTargetLanguageTag(value: string, ctx: z.RefinementCtx): void {
  refineLanguageTag(value, "targetLanguage", ctx);
}

function refineLanguageTag(
  value: string,
  field: "sourceLanguage" | "targetLanguage",
  ctx: z.RefinementCtx,
): void {
  try {
    validateLanguageTag(value, field);
  } catch (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
