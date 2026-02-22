import type { PhoneticsOutput } from "../models";
import type { Plugin } from "../plugin";
import { z } from "zod";

export type AccentType = "ONE" | "MULTIPLE_MEANING" | "MULTIPLE_VARIANT";

export type VduKirciuoklisOutput = PhoneticsOutput;

export type VduKirciuoklisPluginConfig = {
  endpoint?: string;
  nonce?: string;
  itemConcurrency?: number;
};

type ApiRes = {
  code: number;
  message: string | false;
};

type RawWordTextPart = {
  string: string;
  accented: string;
  accentType: AccentType;
  type: "WORD";
};

type RawSeparatorTextPart = {
  string: string;
  type: "SEPARATOR";
};

type RawTextAccents = {
  textParts: Array<RawWordTextPart | RawSeparatorTextPart>;
};

const DEFAULT_ENDPOINT = "https://kalbu.vdu.lt/ajax-call";
const DEFAULT_NONCE = "880129de2d";
export const VduKirciuoklisOptionsSchema = z
  .object({
    mode: z.enum(["text", "auto", "word"]).optional(),
  })
  .strict();

export type VduKirciuoklisOptions = z.infer<typeof VduKirciuoklisOptionsSchema>;

export function vduKirciuoklis(
  config: VduKirciuoklisPluginConfig = {},
): Plugin<VduKirciuoklisOptions, VduKirciuoklisOutput> {
  const endpoint = config.endpoint ?? DEFAULT_ENDPOINT;
  const nonce = config.nonce ?? DEFAULT_NONCE;

  return {
    kind: "PHONETICS",
    provider: "vdu_kirciuoklis",
    version: "0.3.1",
    itemConcurrency: config.itemConcurrency,
    validateOptions(options: VduKirciuoklisOptions): void {
      VduKirciuoklisOptionsSchema.parse(options);
    },
    async run(
      input: string,
      _options: VduKirciuoklisOptions,
      ctx,
    ): Promise<VduKirciuoklisOutput> {
      const raw = await callTextAccents(ctx, endpoint, nonce, input);
      return normalizeTextAccents(raw);
    },
  };
}

async function callTextAccents(
  ctx: Parameters<
    Plugin<VduKirciuoklisOptions, VduKirciuoklisOutput>["run"]
  >[2],
  endpoint: string,
  nonce: string,
  text: string,
): Promise<RawTextAccents> {
  const res = await ctx.callExternal<ApiRes>({
    operation: "vdu_kirciuoklis.text_accents",
    input: text,
    cacheIdentity: {
      schema: "v1",
      value: {
        input: text,
      },
    },
    request: {
      url: endpoint,
      method: "POST",
      form: {
        action: "text_accents",
        nonce,
        body: text,
      },
      timeoutMs: 30_000,
    },
  });
  return parseApiMessage<RawTextAccents>(res);
}

function parseApiMessage<T>(res: ApiRes): T {
  if (res.code !== 200 || res.message === false) {
    throw new Error(`VDU API error (${res.code})`);
  }
  return JSON.parse(res.message) as T;
}

function normalizeTextAccents(raw: RawTextAccents): VduKirciuoklisOutput {
  if (!Array.isArray(raw.textParts)) {
    throw new Error("VDU API error: textParts must be an array");
  }

  const normalized: VduKirciuoklisOutput = [];

  for (const part of raw.textParts) {
    if (part == null || typeof part !== "object") {
      throw new Error("VDU API error: invalid textParts item");
    }

    if (part.type === "SEPARATOR") {
      if (typeof part.string !== "string") {
        throw new Error("VDU API error: separator.string must be a string");
      }
      continue;
    }

    if (part.type !== "WORD") {
      throw new Error(
        `VDU API error: unsupported token type "${String((part as { type?: unknown }).type)}"`,
      );
    }

    if (typeof part.accented !== "string" || part.accented.length === 0) {
      throw new Error(
        "VDU API error: word.accented must be a non-empty string",
      );
    }
    if (!isAccentType(part.accentType)) {
      throw new Error(
        `VDU API error: unsupported accentType "${String((part as { accentType?: unknown }).accentType)}"`,
      );
    }

    if (part.accentType === "ONE") {
      normalized.push(part.accented);
    } else {
      normalized.push({
        accented: part.accented,
        accentType: part.accentType,
      });
    }
  }

  return normalized;
}

function isAccentType(value: unknown): value is AccentType {
  return (
    value === "ONE" ||
    value === "MULTIPLE_MEANING" ||
    value === "MULTIPLE_VARIANT"
  );
}
