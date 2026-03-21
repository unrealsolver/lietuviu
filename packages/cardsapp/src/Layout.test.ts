import { resolveAppLayoutGate } from "./Layout.logic";
import { describe, expect, test } from "bun:test";

describe("AppLayout gate resolution", () => {
  test("returns init-error when startup error is present", () => {
    expect(
      resolveAppLayoutGate({
        initError: "boom",
        isFirstStartup: null,
        confirmWipe: null,
      }),
    ).toBe("init-error");
  });

  test("returns loading while startup flags are unresolved", () => {
    expect(
      resolveAppLayoutGate({
        initError: null,
        isFirstStartup: null,
        confirmWipe: false,
      }),
    ).toBe("loading");

    expect(
      resolveAppLayoutGate({
        initError: null,
        isFirstStartup: false,
        confirmWipe: null,
      }),
    ).toBe("loading");
  });

  test("returns disclaimer when first startup is true", () => {
    expect(
      resolveAppLayoutGate({
        initError: null,
        isFirstStartup: true,
        confirmWipe: false,
      }),
    ).toBe("disclaimer");
  });

  test("returns wipe-confirm when wipe confirmation is needed", () => {
    expect(
      resolveAppLayoutGate({
        initError: null,
        isFirstStartup: false,
        confirmWipe: true,
      }),
    ).toBe("wipe-confirm");
  });

  test("returns ready when no gates block rendering", () => {
    expect(
      resolveAppLayoutGate({
        initError: null,
        isFirstStartup: false,
        confirmWipe: false,
      }),
    ).toBe("ready");
  });
});
