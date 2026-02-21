import { vduKirciuoklis } from "./plugin";
import { describe, expect, test } from "bun:test";

describe("vdu_kirciuoklis plugin", () => {
  test("normalizes text accents and removes separators", async () => {
    const plugin = vduKirciuoklis();
    const operations: string[] = [];

    const output = await plugin.run(
      "apsauginiai akiniai",
      { mode: "auto" },
      {
        callExternal: async (request) => {
          operations.push(request.operation);
          return {
            code: 200,
            message: JSON.stringify({
              textParts: [
                {
                  string: "apsauginiai",
                  accented: "apsaugìniai",
                  accentType: "ONE",
                  type: "WORD",
                },
                {
                  string: " ",
                  type: "SEPARATOR",
                },
                {
                  string: "akiniai",
                  accented: "akiniaĩ",
                  accentType: "MULTIPLE_MEANING",
                  type: "WORD",
                },
              ],
            }),
          };
        },
      },
    );

    expect(operations).toEqual(["vdu_kirciuoklis.text_accents"]);
    expect(output).toEqual([
      "apsaugìniai",
      {
        accented: "akiniaĩ",
        accentType: "MULTIPLE_MEANING",
      },
    ]);
  });

  test("fails on unknown token type", async () => {
    const plugin = vduKirciuoklis();

    await expect(
      plugin.run(
        "labas",
        { mode: "text" },
        {
          callExternal: async () => {
            return {
              code: 200,
              message: JSON.stringify({
                textParts: [
                  {
                    string: "labas",
                    accented: "lãbas",
                    accentType: "ONE",
                    type: "PUNCT",
                  },
                ],
              }),
            };
          },
        },
      ),
    ).rejects.toThrow('VDU API error: unsupported token type "PUNCT"');
  });

  test("fails on unknown accent type", async () => {
    const plugin = vduKirciuoklis();

    await expect(
      plugin.run(
        "labas",
        { mode: "text" },
        {
          callExternal: async () => {
            return {
              code: 200,
              message: JSON.stringify({
                textParts: [
                  {
                    string: "labas",
                    accented: "lãbas",
                    accentType: "SOMETHING_NEW",
                    type: "WORD",
                  },
                ],
              }),
            };
          },
        },
      ),
    ).rejects.toThrow('VDU API error: unsupported accentType "SOMETHING_NEW"');
  });
});
