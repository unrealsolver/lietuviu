import type { ItemProgressEvent } from "./integrations";
import { ProgressRenderer } from "./progress";
import { describe, expect, test } from "bun:test";

function event(overrides: Partial<ItemProgressEvent>): ItemProgressEvent {
  return {
    featureId: "translategemma-1",
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
});
