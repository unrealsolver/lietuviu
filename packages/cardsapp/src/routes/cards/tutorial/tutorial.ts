export type TutorialGesture = "left" | "right" | "down";

export type TutorialIntroStepId =
  | "welcome"
  | "reveal-back"
  | "return-front"
  | "swipe-left"
  | "swipe-right"
  | "practice-ready";

export type TutorialStepFace = {
  badge: string;
  title: string;
  description?: string;
};

export type TutorialPracticeWord = {
  word: string;
  translation: string;
  left: number;
  right: number;
};

export type TutorialIntroStep = {
  id: TutorialIntroStepId;
  allowedGestures: TutorialGesture[];
  front: TutorialStepFace;
  back?: TutorialStepFace;
};

export const TUTORIAL_PRACTICE_WORDS = [
  { word: "miškas", translation: "forest" },
  { word: "katė", translation: "cat" },
  { word: "eiti", translation: "to go" },
] as const;

export const TUTORIAL_INTRO_STEPS: TutorialIntroStep[] = [
  {
    id: "welcome",
    allowedGestures: ["left", "right"],
    front: {
      badge: "Step 1",
      title: "Swipe left or right",
      description: "Move to the next card.",
    },
  },
  {
    id: "reveal-back",
    allowedGestures: ["down"],
    front: {
      badge: "Step 2",
      title: "Pull down",
      description: "Reveal the back of the card.",
    },
    back: {
      badge: "Back",
      title: "This is the back",
      description: "Pull down again to go back.",
    },
  },
  {
    id: "return-front",
    allowedGestures: ["left", "right", "down"],
    front: {
      badge: "Next",
      title: "Swipe this card away",
      description: "Then we will explain what left swipe means.",
    },
    back: {
      badge: "Step 3",
      title: "Pull down again",
      description: "Go back to the front.",
    },
  },
  {
    id: "swipe-left",
    allowedGestures: ["left"],
    front: {
      badge: "Step 4",
      title: "Swipe left",
      description: "Use this when the word feels easy.",
    },
  },
  {
    id: "swipe-right",
    allowedGestures: ["right"],
    front: {
      badge: "Step 5",
      title: "Swipe right",
      description: "Use this when you want more repetition.",
    },
  },
  {
    id: "practice-ready",
    allowedGestures: ["left", "right"],
    front: {
      badge: "Practice",
      title: "Now try real words",
      description: "Swipe to start. No more locked steps.",
    },
  },
];

const INTRO_STEP_INDEX: Record<TutorialIntroStepId, number> =
  TUTORIAL_INTRO_STEPS.reduce(
    (result, step, index) => {
      result[step.id] = index;
      return result;
    },
    {} as Record<TutorialIntroStepId, number>,
  );

export function advanceTutorialIntroStep(
  currentStepId: TutorialIntroStepId,
  gesture: TutorialGesture,
): TutorialIntroStepId | null {
  if (currentStepId === "return-front") {
    return gesture === "down" ? null : "swipe-left";
  }

  const currentStep = TUTORIAL_INTRO_STEPS[INTRO_STEP_INDEX[currentStepId]];
  if (!currentStep.allowedGestures.includes(gesture)) {
    return null;
  }

  const nextStep = TUTORIAL_INTRO_STEPS[INTRO_STEP_INDEX[currentStepId] + 1];
  return nextStep?.id ?? null;
}

export function getTutorialIntroFaces(stepId: TutorialIntroStepId) {
  if (stepId === "return-front") {
    const returnFrontStep =
      TUTORIAL_INTRO_STEPS[INTRO_STEP_INDEX["return-front"]];
    const pullDownStep = TUTORIAL_INTRO_STEPS[INTRO_STEP_INDEX["reveal-back"]];
    return {
      front: returnFrontStep.front,
      back: pullDownStep.back ?? pullDownStep.front,
    };
  }

  const step = TUTORIAL_INTRO_STEPS[INTRO_STEP_INDEX[stepId]];
  if (step == null) {
    return null;
  }

  return {
    front: step.front,
    back: step.back ?? step.front,
  };
}

export function createTutorialPracticeWords(): TutorialPracticeWord[] {
  return TUTORIAL_PRACTICE_WORDS.map((word) => ({
    ...word,
    left: 0,
    right: 0,
  }));
}

export function applyTutorialPracticeSwipe(
  words: TutorialPracticeWord[],
  index: number,
  direction: "left" | "right",
): TutorialPracticeWord[] {
  return words.map((word, wordIndex) => {
    if (wordIndex !== index) {
      return word;
    }
    return {
      ...word,
      left: word.left + (direction === "left" ? 1 : 0),
      right: word.right + (direction === "right" ? 1 : 0),
    };
  });
}

export function getTutorialPracticeProgress(
  words: TutorialPracticeWord[],
): number {
  const requiredSwipes = words.length * 2;
  if (requiredSwipes === 0) {
    return 0;
  }

  const completedSwipes = words.reduce((total, word) => {
    return total + Math.min(word.left + word.right, 2);
  }, 0);

  return (100 * completedSwipes) / requiredSwipes;
}

export function isTutorialPracticeComplete(
  words: TutorialPracticeWord[],
): boolean {
  return words.every((word) => word.left + word.right >= 2);
}

export function pickNextTutorialPracticeIndex(
  words: TutorialPracticeWord[],
  currentIndex: number,
): number {
  for (let offset = 1; offset <= words.length; offset += 1) {
    const nextIndex = (currentIndex + offset) % words.length;
    const nextWord = words[nextIndex];
    if (nextWord != null && nextWord.left + nextWord.right < 2) {
      return nextIndex;
    }
  }

  if (words.length === 0) {
    return 0;
  }

  return (currentIndex + 1) % words.length;
}
