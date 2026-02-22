import type { TranslationOutput } from "../models";
import { NoResultError, type Plugin } from "../plugin";
import { parse } from "parse5";

export type LietuviuRusuOptions = Record<string, never>;

export type LietuviuRusuOutput = TranslationOutput;

export type LietuviuRusuPluginConfig = {
  baseUrl?: string;
  itemConcurrency?: number;
};

const DEFAULT_BASE_URL = "http://www.lietuviu-rusu.com";

type Parse5Node = {
  nodeName?: string;
  value?: string;
  childNodes?: Parse5Node[];
};

type Parse5Element = Parse5Node & {
  tagName?: string;
};

export function lietuviuRusu(
  config: LietuviuRusuPluginConfig = {},
): Plugin<LietuviuRusuOptions, LietuviuRusuOutput> {
  const baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/u, "");

  return {
    kind: "TRANSLATION",
    provider: "lietuviuRusu",
    version: "0.1.0",
    itemConcurrency: config.itemConcurrency ?? 4,
    validateOptions(options: LietuviuRusuOptions): void {
      if (options == null || typeof options !== "object") {
        throw new Error("lietuviuRusu options must be an object");
      }
      if (Object.keys(options).length > 0) {
        throw new Error("lietuviuRusu does not accept options");
      }
    },
    async run(input: string, _options: LietuviuRusuOptions, ctx) {
      const html = await ctx.callExternal<string>({
        operation: "lietuviuRusu.word_page",
        input,
        cacheIdentity: {
          schema: "v1",
          value: {
            input,
          },
        },
        request: {
          url: `${baseUrl}/${encodeURIComponent(input)}/`,
          method: "GET",
          responseType: "text",
          timeoutMs: 30_000,
        },
      });

      return extractTranslationFromHtml(html);
    },
  };
}

export function extractTranslationFromHtml(html: string): string {
  const doc = parse(html) as Parse5Node;
  const htmlEl = firstElementByTag(doc, "html");
  const bodyEl = nthElementByTag(htmlEl, "body", 1);
  const secondDiv = nthElementByTag(bodyEl, "div", 2);
  const mainEl = nthElementByTag(secondDiv, "main", 1);
  const mainText = collectText(mainEl).replace(/\s+/gu, " ").trim();
  if (mainText.includes("Nėra vertimo")) {
    throw new NoResultError("lietuviuRusu: no translation");
  }
  const pEl = nthElementByTag(mainEl, "p", 1);

  const childNodes = pEl.childNodes ?? [];
  const hasTagChildren = childNodes.some((child) => isElement(child));
  if (hasTagChildren) {
    throw new Error("lietuviuRusu HTML parse error: translation contains tags");
  }

  const text = childNodes
    .map((child) => (child.nodeName === "#text" ? (child.value ?? "") : ""))
    .join("")
    .trim()
    .toLocaleLowerCase();

  if (text.length === 0) {
    throw new Error("lietuviuRusu HTML parse error: empty translation");
  }

  return text;
}

function nthElementByTag(
  parent: Parse5Node | null,
  tagName: string,
  n: number,
): Parse5Element {
  if (parent == null) {
    throw new Error(
      `lietuviuRusu HTML parse error: missing parent for ${tagName}`,
    );
  }
  let count = 0;
  for (const child of parent.childNodes ?? []) {
    if (!isElement(child)) {
      continue;
    }
    if (child.tagName !== tagName) {
      continue;
    }
    count += 1;
    if (count === n) {
      return child;
    }
  }
  throw new Error(
    `lietuviuRusu HTML parse error: xpath segment ${tagName}[${n}] not found`,
  );
}

function firstElementByTag(parent: Parse5Node, tagName: string): Parse5Element {
  return nthElementByTag(parent, tagName, 1);
}

function isElement(node: Parse5Node | null | undefined): node is Parse5Element {
  return (
    node != null && typeof node === "object" && typeof node.tagName === "string"
  );
}

function collectText(node: Parse5Node | null | undefined): string {
  if (node == null) {
    return "";
  }
  if (node.nodeName === "#text") {
    return node.value ?? "";
  }
  return (node.childNodes ?? []).map((child) => collectText(child)).join("");
}
