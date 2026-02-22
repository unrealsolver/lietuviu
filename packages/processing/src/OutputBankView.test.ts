import { OutputBankView } from "./OutputBankView";
import type { OutputBank } from "./integrations";
import { describe, expect, test } from "bun:test";

describe("OutputBankView", () => {
  const bank: OutputBank = {
    schemaVersion: "1.0.0",
    title: "Test",
    sourceLanguage: "lit",
    generatedAt: "2026-01-01T00:00:00.000Z",
    features: [
      {
        id: "dict-1",
        type: "TRANSLATION",
        provider: "dict",
        version: "1.0.0",
      },
      {
        id: "gemma-1",
        type: "TRANSLATION",
        provider: "gemma",
        version: "1.0.0",
      },
      {
        id: "gemma-exp-1",
        type: "TRANSLATION",
        group: "experimental",
        provider: "gemma",
        version: "1.0.0",
      },
      {
        id: "phon-1",
        type: "PHONETICS",
        provider: "vdu_kirciuoklis",
        version: "1.0.0",
      },
    ],
    data: [
      {
        input: "hit",
        features: {
          "dict-1": { output: "dict:hit" },
          "phon-1": { output: ["hĩt"] },
        },
      },
      {
        input: "miss",
        features: {
          "gemma-1": { output: "gemma:miss" },
          "gemma-exp-1": { output: "gemma-exp:miss" },
        },
      },
      {
        input: "ambiguous",
        features: {
          "dict-1": { output: "dict:ambiguous" },
          "gemma-1": { output: "gemma:ambiguous" },
        },
      },
    ],
  };

  test("reports present feature types and groups", () => {
    const view = new OutputBankView(bank);

    expect(view.getFeatureTypes()).toEqual(["TRANSLATION", "PHONETICS"]);
    expect(view.getGroupsForType("TRANSLATION")).toEqual([
      "default",
      "experimental",
    ]);
    expect(view.getGroupsForType("PHONETICS")).toEqual(["default"]);
    expect(view.getGroupForFeature("dict-1")).toBe("default");
    expect(view.getGroupForFeature("gemma-exp-1")).toBe("experimental");
    expect(view.getGroupForFeature("missing")).toBeNull();
  });

  test("resolves output by type with implicit default group", () => {
    const view = new OutputBankView(bank);
    const hit = bank.data.find((item) => item.input === "hit")!;
    const miss = bank.data.find((item) => item.input === "miss")!;

    expect(view.resolveFeatureOutput(hit, "TRANSLATION")).toBe("dict:hit");
    expect(view.resolveFeatureOutput(miss, "TRANSLATION")).toBe("gemma:miss");
    expect(view.resolveFeatureOutput(hit, "PHONETICS")).toEqual(["hĩt"]);
  });

  test("requires explicit group for non-default group lookups", () => {
    const view = new OutputBankView(bank);
    const miss = bank.data.find((item) => item.input === "miss")!;

    expect(view.resolveFeatureOutput(miss, "TRANSLATION", "experimental")).toBe(
      "gemma-exp:miss",
    );
  });

  test("resolves which feature actually won", () => {
    const view = new OutputBankView(bank);
    const hit = bank.data.find((item) => item.input === "hit")!;
    const miss = bank.data.find((item) => item.input === "miss")!;

    const hitMatch = view.resolveFeatureMatch(hit, "TRANSLATION");
    const missMatch = view.resolveFeatureMatch(miss, "TRANSLATION");
    const expMatch = view.resolveFeatureMatch(
      miss,
      "TRANSLATION",
      "experimental",
    );

    expect(hitMatch?.feature.id).toBe("dict-1");
    expect(hitMatch?.output).toBe("dict:hit");

    expect(missMatch?.feature.id).toBe("gemma-1");
    expect(missMatch?.output).toBe("gemma:miss");

    expect(expMatch?.feature.id).toBe("gemma-exp-1");
    expect(expMatch?.output).toBe("gemma-exp:miss");
  });

  test("returns null on missing or ambiguous resolution", () => {
    const view = new OutputBankView(bank);
    const hit = bank.data.find((item) => item.input === "hit")!;
    const ambiguous = bank.data.find((item) => item.input === "ambiguous")!;

    expect(view.resolveFeatureOutput(hit, "MORPHOLOGY")).toBeNull();
    expect(
      view.resolveFeatureOutput(hit, "TRANSLATION", "experimental"),
    ).toBeNull();
    expect(view.resolveFeatureOutput(ambiguous, "TRANSLATION")).toBeNull();
    expect(view.resolveFeatureMatch(ambiguous, "TRANSLATION")).toBeNull();
  });
});
