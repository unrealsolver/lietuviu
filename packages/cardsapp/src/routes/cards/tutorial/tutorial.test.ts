import {
  advanceTutorialIntroStep,
  applyTutorialPracticeSwipe,
  createTutorialPracticeWords,
  getTutorialPracticeProgress,
  isTutorialPracticeComplete,
  pickNextTutorialPracticeIndex,
} from "./tutorial";
import { describe, expect, test } from "bun:test";

describe("tutorial intro flow", () => {
  test("advances only on the expected gesture", () => {
    expect(advanceTutorialIntroStep("welcome", "down")).toBeNull();
    expect(advanceTutorialIntroStep("welcome", "left")).toBe("reveal-back");
    expect(advanceTutorialIntroStep("reveal-back", "down")).toBe(
      "return-front",
    );
    expect(advanceTutorialIntroStep("return-front", "down")).toBeNull();
    expect(advanceTutorialIntroStep("return-front", "left")).toBe("swipe-left");
  });
});

describe("tutorial practice flow", () => {
  test("counts progress up to two swipes per word", () => {
    let words = createTutorialPracticeWords();
    expect(getTutorialPracticeProgress(words)).toBe(0);

    words = applyTutorialPracticeSwipe(words, 0, "left");
    expect(getTutorialPracticeProgress(words)).toBeCloseTo(100 / 6, 5);

    words = applyTutorialPracticeSwipe(words, 0, "right");
    expect(getTutorialPracticeProgress(words)).toBeCloseTo(200 / 6, 5);

    words = applyTutorialPracticeSwipe(words, 0, "right");
    expect(getTutorialPracticeProgress(words)).toBeCloseTo(200 / 6, 5);
  });

  test("detects completion and picks the next incomplete word", () => {
    let words = createTutorialPracticeWords();
    words = applyTutorialPracticeSwipe(words, 0, "left");
    words = applyTutorialPracticeSwipe(words, 0, "left");
    words = applyTutorialPracticeSwipe(words, 1, "right");

    expect(isTutorialPracticeComplete(words)).toBe(false);
    expect(pickNextTutorialPracticeIndex(words, 0)).toBe(1);
    expect(pickNextTutorialPracticeIndex(words, 1)).toBe(2);

    words = applyTutorialPracticeSwipe(words, 1, "right");
    words = applyTutorialPracticeSwipe(words, 2, "left");
    words = applyTutorialPracticeSwipe(words, 2, "right");

    expect(isTutorialPracticeComplete(words)).toBe(true);
  });
});
