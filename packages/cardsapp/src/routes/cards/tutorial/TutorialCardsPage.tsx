import { version, homepage } from "../../../../package.json";
import { CardFace } from "../CardFace";
import { CardsScaffold } from "../CardsScaffold";
import { InteractiveCard } from "../InteractiveCard";
import classes from "./TutorialCardsPage.module.css";
import {
  advanceTutorialIntroStep,
  applyTutorialPracticeSwipe,
  createTutorialPracticeWords,
  getTutorialIntroFaces,
  getTutorialPracticeProgress,
  isTutorialPracticeComplete,
  pickNextTutorialPracticeIndex,
  TUTORIAL_INTRO_STEPS,
  type TutorialStepFace,
  type TutorialIntroStepId,
} from "./tutorial";
import { Anchor, Group, Progress, Stack, Text, Title } from "@mantine/core";
import { useMemo, useState } from "react";
import { Link } from "react-router";

const TUTORIAL_LOCK_MS = 1000;
type TutorialMode = "intro" | "practice" | "complete";

type TutorialFaceProps = {
  badge: string;
  title: string;
  description?: string;
  translation?: string;
};

function TutorialFace({
  badge,
  title,
  description,
  translation,
}: TutorialFaceProps) {
  return (
    <CardFace centered={false}>
      <Stack h="100%" justify="center" gap="xl" className={classes.face}>
        <Text c="dimmed" size="xs" fw={700} className={classes.eyebrow}>
          {badge}
        </Text>
        <Stack gap="sm">
          <Title
            ta="center"
            order={translation == null ? 2 : 1}
            ff={translation == null ? undefined : "serif"}
          >
            {title}
          </Title>
          {description != null ? (
            <Text size="lg" className={classes.body} c="dimmed">
              {description}
            </Text>
          ) : null}
          {translation != null ? (
            <Text size="xl" fw={600}>
              {translation}
            </Text>
          ) : null}
        </Stack>
      </Stack>
    </CardFace>
  );
}

function TutorialCompleteCard() {
  return (
    <CardFace centered={false}>
      <Stack h="100%" justify="center" gap="xl" className={classes.face}>
        <Text c="dimmed" size="xs" fw={700} className={classes.eyebrow}>
          Done
        </Text>
        <Stack gap="sm">
          <Title ta="center" order={2}>
            Tutorial complete
          </Title>
          <Text size="lg" className={classes.body} c="dimmed">
            Open the real deck and start swiping vocabulary cards.
          </Text>
        </Stack>
        <Anchor component={Link} to="/cards">
          Open real deck
        </Anchor>
      </Stack>
    </CardFace>
  );
}

function TutorialPracticeFront({
  word,
  progress,
}: {
  word: string;
  progress: number;
}) {
  return (
    <TutorialFace
      badge={`Practice ${Math.round(progress)}%`}
      title={word}
      description="Swipe left or right. Pull down to check the translation."
    />
  );
}

function TutorialPracticeBack({
  word,
  translation,
  swipeCount,
}: {
  word: string;
  translation: string;
  swipeCount: number;
}) {
  return (
    <TutorialFace
      badge={`${swipeCount} / 2 swipes`}
      title={word}
      translation={translation}
      description="Pull down to hide the answer, then choose a side."
    />
  );
}

function renderIntroFace(face: TutorialStepFace) {
  return (
    <TutorialFace
      badge={face.badge}
      title={face.title}
      description={face.description}
    />
  );
}

export function TutorialCardsPage() {
  const [mode, setMode] = useState<TutorialMode>("intro");
  const [introStepId, setIntroStepId] =
    useState<TutorialIntroStepId>("welcome");
  const [practiceWords, setPracticeWords] = useState(
    createTutorialPracticeWords,
  );
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [cardInstance, setCardInstance] = useState(0);

  const introStep = useMemo(() => {
    return TUTORIAL_INTRO_STEPS.find((step) => step.id === introStepId) ?? null;
  }, [introStepId]);
  const introFaces = useMemo(() => {
    return getTutorialIntroFaces(introStepId);
  }, [introStepId]);

  const practiceWord = practiceWords[practiceIndex] ?? null;
  const tutorialProgress = getTutorialPracticeProgress(practiceWords);

  function advanceIntro(gesture: "left" | "right" | "down") {
    if (introStepId === "practice-ready") {
      if (!introStep?.allowedGestures.includes(gesture)) {
        return;
      }

      setMode("practice");
      setCardInstance((value) => value + 1);
      return;
    }

    const nextStepId = advanceTutorialIntroStep(introStepId, gesture);
    if (nextStepId == null) {
      return;
    }

    setIntroStepId(nextStepId);

    if (
      introStepId === "welcome" ||
      introStepId === "return-front" ||
      introStepId === "swipe-left" ||
      introStepId === "swipe-right"
    ) {
      setCardInstance((value) => value + 1);
    }
  }

  function handlePracticeSwipe(direction: "left" | "right") {
    if (practiceWord == null) {
      return;
    }

    const nextWords = applyTutorialPracticeSwipe(
      practiceWords,
      practiceIndex,
      direction,
    );
    setPracticeWords(nextWords);

    if (isTutorialPracticeComplete(nextWords)) {
      setMode("complete");
      setCardInstance((value) => value + 1);
      return;
    }

    setPracticeIndex(pickNextTutorialPracticeIndex(nextWords, practiceIndex));
    setCardInstance((value) => value + 1);
  }

  return (
    <CardsScaffold
      header={
        mode === "intro" ? null : (
          <Progress.Root size="xl" flex={1}>
            <Progress.Section value={tutorialProgress} color="green" />
          </Progress.Root>
        )
      }
      footer={
        <Group gap="xs">
          <Anchor size="sm" underline="not-hover" component={Link} to="/cards">
            Real deck
          </Anchor>
          <Anchor
            size="sm"
            underline="not-hover"
            href={`${homepage}/deployments`}
          >
            v{version}
          </Anchor>
        </Group>
      }
    >
      {mode === "intro" && introStep != null ? (
        <InteractiveCard
          key={`intro-${cardInstance}`}
          front={renderIntroFace(introFaces?.front ?? introStep.front)}
          back={renderIntroFace(introFaces?.back ?? introStep.front)}
          onSwipeLeft={() => advanceIntro("left")}
          onSwipeRight={() => advanceIntro("right")}
          onPullDownComplete={() => advanceIntro("down")}
          allowSwipeLeft={introStep.allowedGestures.includes("left")}
          allowSwipeRight={introStep.allowedGestures.includes("right")}
          allowPullDown={introStep.allowedGestures.includes("down")}
          lockKey={introStepId}
          lockDurationMs={TUTORIAL_LOCK_MS}
        />
      ) : null}
      {mode === "practice" && practiceWord != null ? (
        <InteractiveCard
          key={`practice-${cardInstance}`}
          front={
            <TutorialPracticeFront
              word={practiceWord.word}
              progress={tutorialProgress || 0}
            />
          }
          back={
            <TutorialPracticeBack
              word={practiceWord.word}
              translation={practiceWord.translation}
              swipeCount={practiceWord.left + practiceWord.right}
            />
          }
          onSwipeLeft={() => handlePracticeSwipe("left")}
          onSwipeRight={() => handlePracticeSwipe("right")}
        />
      ) : null}
      {mode === "complete" ? (
        <InteractiveCard
          key={`complete-${cardInstance}`}
          front={<TutorialCompleteCard />}
          back={<TutorialCompleteCard />}
          allowSwipeLeft={false}
          allowSwipeRight={false}
          allowPullDown={false}
        />
      ) : null}
    </CardsScaffold>
  );
}
