import { InputBankReader } from "./InputBankReader";
import type { InputBank } from "./integrations/models";
import { describe, expect, test } from "bun:test";

describe("InputBankReader", () => {
  const bank: InputBank = {
    schemaVersion: "1.0.0",
    title: "Input Bank",
    sourceLanguage: "lit",
    features: [
      {
        provider: "lietuviuRusu",
        options: {},
      },
      {
        id: "gemma-main",
        provider: "translategemma",
        options: {},
      },
      {
        group: "experimental",
        provider: "translategemma",
        options: {},
      },
    ],
    data: ["ačiū", "labas"],
  };

  test("resolves runtime feature ids in source order", () => {
    const reader = new InputBankReader(bank);

    expect(reader.getItemCount()).toBe(2);
    expect(reader.getItems()).toEqual(["ačiū", "labas"]);
    expect(reader.getResolvedFeatures().map((f) => f.featureId)).toEqual([
      "lietuviurusu-1",
      "gemma-main",
      "translategemma-1",
    ]);
    expect(reader.getResolvedFeatures().map((f) => f.featureOrder)).toEqual([
      0, 1, 2,
    ]);
  });

  test("normalizes groups and resolves by feature id", () => {
    const reader = new InputBankReader(bank);

    expect(reader.getGroupForFeature("lietuviurusu-1")).toBe("default");
    expect(reader.getGroupForFeature("translategemma-1")).toBe("experimental");
    expect(reader.getGroupForFeature("missing")).toBeNull();

    expect(reader.getFeatureById("gemma-main")?.provider).toBe(
      "translategemma",
    );
    expect(reader.getFeatureById("gemma-main")?.group).toBe("default");
    expect(reader.getFeatureById("unknown")).toBeNull();
  });

  test("defaults missing bank version to 0.0.0", () => {
    const reader = new InputBankReader(bank);

    expect(reader.getBank().version).toBe("0.0.0");
  });
});
