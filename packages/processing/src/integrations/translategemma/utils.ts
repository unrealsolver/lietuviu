import Handlebars from "handlebars";
import { getByTag, getByISO6391, getByISO6392 } from "locale-codes";
import { createHash } from "node:crypto";

type LocaleInfo = {
  name: string;
  "iso639-1": string;
};

const PROMPT_TEMPLATE = `
You are a professional {{SOURCE_LANG}} ({{SOURCE_CODE}}) to {{TARGET_LANG}} ({{TARGET_CODE}}) translator. Your goal is to accurately convey the meaning and nuances of the original {{SOURCE_LANG}} text while adhering to {{TARGET_LANG}} grammar, vocabulary, and cultural sensitivities.
{{EXTRA_PROMPT}}
Produce only the {{TARGET_LANG}} translation, without any additional explanations or commentary. Please translate the following {{SOURCE_LANG}} text into {{TARGET_LANG}}:


{{TEXT}}`;

const renderPromptTemplate = Handlebars.compile(PROMPT_TEMPLATE);

export function renderPrompt(params: {
  sourceLanguageTag: string;
  targetLanguageTag: string;
  input: string;
  extraPrompt?: string;
}): string {
  const sourceLocale = resolveLocaleOrThrow(
    params.sourceLanguageTag,
    "sourceLanguage",
  );
  const targetLocale = resolveLocaleOrThrow(
    params.targetLanguageTag,
    "targetLanguage",
  );

  return renderPromptTemplate({
    SOURCE_LANG: sourceLocale.name,
    SOURCE_CODE: sourceLocale["iso639-1"],
    TARGET_LANG: targetLocale.name,
    TARGET_CODE: targetLocale["iso639-1"],
    EXTRA_PROMPT: params.extraPrompt ?? "",
    TEXT: params.input,
  }).trim();
}

export function validateLanguageTag(
  tag: string,
  field: "sourceLanguage" | "targetLanguage",
): void {
  resolveLocaleOrThrow(tag, field);
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function resolveLocaleOrThrow(
  tag: string,
  field: "sourceLanguage" | "targetLanguage",
): LocaleInfo {
  const byTag = getByTag(tag) as LocaleInfo | undefined;
  if (
    byTag != null &&
    typeof byTag.name === "string" &&
    typeof byTag["iso639-1"] === "string"
  ) {
    return byTag;
  }

  const byIso6391 = getByISO6391(tag) as LocaleInfo | undefined;
  if (
    byIso6391 != null &&
    typeof byIso6391.name === "string" &&
    typeof byIso6391["iso639-1"] === "string"
  ) {
    return byIso6391;
  }

  const byIso6392 = getByISO6392(tag) as LocaleInfo | undefined;
  if (
    byIso6392 != null &&
    typeof byIso6392.name === "string" &&
    typeof byIso6392["iso639-1"] === "string"
  ) {
    return byIso6392;
  }

  throw new Error(`Unsupported ${field} tag: "${tag}"`);
}
