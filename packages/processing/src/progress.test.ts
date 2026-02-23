import type { ItemProgressEvent } from "./integrations";
import { ProgressRenderer } from "./progress";
import { describe, expect, test } from "bun:test";

function event(overrides: Partial<ItemProgressEvent>): ItemProgressEvent {
  return {
    featureId: "translategemma-1",
    featureOrder: 0,
    pluginName: "translategemma",
    total: 100,
    index: 0,
    done: 1,
    outcome: "PASSED",
    ...overrides,
  };
}

describe("progress renderer", () => {
  test("renders updates not more often than once per second", () => {
    let nowMs = 0;
    const out: string[] = [];
    const renderer = new ProgressRenderer({
      interactive: false,
      enabled: true,
      useColors: false,
      minRenderIntervalMs: 1000,
      now: () => nowMs,
      write: (text) => {
        out.push(text);
      },
    });

    renderer.update(event({ index: 0, done: 1 }));
    renderer.update(event({ index: 1, done: 2 }));
    nowMs = 500;
    renderer.update(event({ index: 2, done: 3 }));
    nowMs = 1000;
    renderer.update(event({ index: 4, done: 5 }));

    expect(out).toHaveLength(2);
  });

  test("always renders final completion update even within throttle window", () => {
    let nowMs = 0;
    const out: string[] = [];
    const renderer = new ProgressRenderer({
      interactive: false,
      enabled: true,
      useColors: false,
      minRenderIntervalMs: 1000,
      now: () => nowMs,
      write: (text) => {
        out.push(text);
      },
    });

    renderer.update(event({ total: 2, index: 0, done: 1 }));
    nowMs = 100;
    renderer.update(event({ total: 2, index: 1, done: 2 }));

    expect(out).toHaveLength(2);
  });

  test("preserves source feature order when updates arrive out of order", () => {
    const out: string[] = [];
    const renderer = new ProgressRenderer({
      interactive: false,
      enabled: true,
      useColors: false,
      minRenderIntervalMs: 0,
      write: (text) => {
        out.push(text);
      },
    });

    renderer.update(
      event({
        featureId: "feature-b",
        featureOrder: 1,
        pluginName: "feature-b",
        total: 2,
        done: 1,
        index: 0,
      }),
    );
    renderer.update(
      event({
        featureId: "feature-a",
        featureOrder: 0,
        pluginName: "feature-a",
        total: 2,
        done: 1,
        index: 0,
      }),
    );
    renderer.update(
      event({
        featureId: "feature-a",
        featureOrder: 0,
        pluginName: "feature-a",
        total: 2,
        done: 2,
        index: 1,
      }),
    );
    renderer.update(
      event({
        featureId: "feature-b",
        featureOrder: 1,
        pluginName: "feature-b",
        total: 2,
        done: 2,
        index: 1,
      }),
    );

    expect((renderer as unknown as { order: string[] }).order).toEqual([
      "feature-a",
      "feature-b",
    ]);
  });

  test("can initialize rows from source order before updates", () => {
    const renderer = new ProgressRenderer({
      interactive: false,
      enabled: true,
      useColors: false,
      minRenderIntervalMs: 0,
      write: () => undefined,
    });

    renderer.initialize([
      {
        featureId: "feature-b",
        featureOrder: 1,
        label: "feature-b [TRANSLATION/default]",
        total: 10,
      },
      {
        featureId: "feature-a",
        featureOrder: 0,
        label: "feature-a [PHONETICS/default]",
        total: 10,
      },
    ]);

    const state = renderer as unknown as {
      order: string[];
      rows: Map<string, { label: string; total: number }>;
    };
    expect(state.order).toEqual(["feature-a", "feature-b"]);
    expect(state.rows.get("feature-a")?.label).toContain("[PHONETICS/default]");
    expect(state.rows.get("feature-b")?.total).toBe(10);
  });
});
