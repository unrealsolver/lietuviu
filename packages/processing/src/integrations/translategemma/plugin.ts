import type { TranslationOutput } from "../models";
import type { Plugin } from "../plugin";
import { renderPrompt, sha256, validateLanguageTag } from "./utils";

export type TranslateGemmaOptions = {
  /** Tag such as lt-lt */
  sourceLanguage: string;
  /** Tag such as ru-ru */
  targetLanguage: string;
  /** Extra prompt. Added next to system plugin prompt */
  extraPrompt?: string;
  alternatives?: number;
  temperature?: number;
  outputMode?: "compact" | "full";
};

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
    version: "0.1.0",
    itemConcurrency: pluginConfig.itemConcurrency,
    validateOptions(options: TranslateGemmaOptions): void {
      validateLanguageTag(options.sourceLanguage, "sourceLanguage");
      validateLanguageTag(options.targetLanguage, "targetLanguage");
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
      const translatedText = body.response.trim();

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
