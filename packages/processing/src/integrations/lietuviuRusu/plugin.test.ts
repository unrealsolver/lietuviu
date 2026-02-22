import { NoResultError } from "../plugin";
import { extractTranslationFromHtml, lietuviuRusu } from "./plugin";
import { describe, expect, test } from "bun:test";

describe("lietuviuRusu plugin", () => {
  test("requests HTML page and extracts normalized translation", async () => {
    const plugin = lietuviuRusu({
      baseUrl: "http://www.lietuviu-rusu.com",
    });

    let captured: unknown = null;
    const out = await plugin.run(
      "Ačiū",
      {},
      {
        callExternal: async (request) => {
          captured = request;
          return `
            <html>
              <body>
                <div></div>
                <div>
                  <main>
                    <p>  Спасибо  </p>
                  </main>
                </div>
              </body>
            </html>
          `;
        },
      },
    );

    expect(out).toBe("спасибо");
    expect(captured).toMatchObject({
      operation: "lietuviuRusu.word_page",
      input: "Ačiū",
      cacheIdentity: {
        schema: "v1",
        value: { input: "Ačiū" },
      },
      request: {
        method: "GET",
        responseType: "text",
      },
    });
    expect((captured as { request?: { url?: string } }).request?.url).toBe(
      "http://www.lietuviu-rusu.com/A%C4%8Di%C5%AB/",
    );
  });

  test("fails when translation node is empty", () => {
    expect(() =>
      extractTranslationFromHtml(`
        <html><body><div></div><div><main><p>   </p></main></div></body></html>
      `),
    ).toThrow("lietuviuRusu HTML parse error: empty translation");
  });

  test("fails when translation node contains nested tags", () => {
    expect(() =>
      extractTranslationFromHtml(`
        <html><body><div></div><div><main><p><span>Спасибо</span></p></main></div></body></html>
      `),
    ).toThrow("lietuviuRusu HTML parse error: translation contains tags");
  });

  test('returns NO_RESULT when page says "Nėra vertimo"', () => {
    try {
      extractTranslationFromHtml(`
        <html>
          <body>
            <div></div>
            <div>
              <main>Nėra vertimo</main>
            </div>
          </body>
        </html>
      `);
      throw new Error("expected NoResultError");
    } catch (error) {
      expect(error).toBeInstanceOf(NoResultError);
      expect((error as NoResultError).code).toBe("NO_RESULT");
    }
  });

  test("default concurrency is 4", () => {
    const plugin = lietuviuRusu();
    expect(plugin.itemConcurrency).toBe(4);
  });
});
