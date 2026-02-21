import { translategemma } from "./plugin";
import { describe, expect, test } from "bun:test";

describe("translategemma plugin", () => {
  test("builds external request and returns trimmed translation in compact mode by default", async () => {
    const plugin = translategemma({
      baseUrl: "http://localhost:11434",
      model: "translategemma:12b",
      timeoutMs: 12345,
      headers: {
        Authorization: "Bearer token",
      },
    });

    let captured: unknown = null;
    let progress = 0;

    const out = await plugin.run(
      "ačiū",
      {
        sourceLanguage: "lt-lt",
        targetLanguage: "ru-ru",
        temperature: 0.2,
      },
      {
        callExternal: async (request) => {
          captured = request;
          return {
            response: "  спасибо  ",
          };
        },
        emitProgress: (n) => {
          progress += n;
        },
      },
    );

    expect(out).toBe("спасибо");
    expect(progress).toBe(1);

    expect(captured).toMatchObject({
      operation: "ollama.generate",
      input: "ačiū",
      cacheIdentity: {
        schema: "v1",
        value: {
          model: "translategemma:12b",
        },
      },
      request: {
        url: "http://localhost:11434/api/generate",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token",
        },
        body: {
          model: "translategemma:12b",
          stream: false,
          options: {
            temperature: 0.2,
          },
        },
        timeoutMs: 12345,
      },
    });
    const prompt = (
      captured as {
        request?: { body?: { prompt?: string } };
      }
    ).request?.body?.prompt;
    expect(prompt).toEqual(expect.any(String));
    expect(prompt).toContain("Lithuanian");
    expect(prompt).toContain("Russian");
    expect(prompt).toContain("ačiū");
    expect(
      (captured as { cacheIdentity?: { value?: { promptHash?: string } } })
        .cacheIdentity?.value?.promptHash,
    ).toEqual(expect.any(String));
  });

  test("supports full output mode", async () => {
    const plugin = translategemma({
      model: "translategemma:12b",
    });

    const out = await plugin.run(
      "ačiū",
      {
        sourceLanguage: "lt-lt",
        targetLanguage: "ru-ru",
        outputMode: "full",
      },
      {
        callExternal: async () => {
          return {
            response: "спасибо",
          };
        },
      },
    );

    expect(out).toEqual({
      translatedText: "спасибо",
      alternatives: [],
    });
  });

  test("throws on empty translation response", async () => {
    const plugin = translategemma();

    await expect(
      plugin.run(
        "ačiū",
        {
          sourceLanguage: "lt-lt",
          targetLanguage: "ru-ru",
        },
        {
          callExternal: async () => {
            return { response: "   " };
          },
        },
      ),
    ).rejects.toThrow("Ollama returned an empty translation");
  });

  test("accepts case-insensitive language tags", async () => {
    const plugin = translategemma({
      model: "translategemma:12b",
    });

    const out = await plugin.run(
      "ačiū",
      {
        sourceLanguage: "LT-lt",
        targetLanguage: "Ru-rU",
      },
      {
        callExternal: async () => {
          return { response: "спасибо" };
        },
      },
    );

    expect(out).toBe("спасибо");
  });
});
