import { version, homepage } from "../../../package.json";
import { db } from "../../db";
import { AnimatedCard } from "./AnimatedCard";
import classes from "./CardsPage.module.css";
import type { WordStat } from "./util";
import { type BankPrototype } from "@ltk/processing";
import {
  ActionIcon,
  Center,
  Group,
  Progress,
  Stack,
  useComputedColorScheme,
  useMantineColorScheme,
  Anchor,
} from "@mantine/core";
import { IconSun, IconMoon } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";

const _bank = await import("@ltk/databanks");

const bank = { data: [] };
const words = _bank.data;

type Word = string;

const ALMOST_ONE = 0.999999;

const wordStat = words.reduce(
  (m, d) => {
    m[d.word] = {
      accepts: 0,
      rejects: 0,
    };
    return m;
  },
  {} as Record<Word, WordStat>,
);

//type WordBank = {
//  name: string;
//  version: string;
//  words: Word[];
//};
//
//type WordInfo = {
//  name: string;
//  stressed: string;
//  translations: Array<{
//    locale: string;
//    content: string;
//  }>;
//};

function getRate(stat: WordStat) {
  return stat.rejects > 0
    ? stat.accepts / (stat.accepts + stat.rejects)
    : stat.accepts > 0
      ? 1
      : 0;
}

function rebuildGroups(wordStat: Record<string, WordStat>): Array<Set<Word>> {
  const groups = [...Array(10)].map(() => new Set<Word>());

  Object.entries(wordStat).map(([word, stat]) => {
    // success rate of 0.0..1.0
    const rawRate = getRate(stat);

    // We need >=0 and < 1.0 range for proper 0-9 categories mapping
    const normRate = rawRate * ALMOST_ONE;

    const groupIdx = Math.floor(normRate * 10);

    groups[groupIdx].add(word);
  });

  //groups.map((d, idx) => {
  //  console.debug(`${idx}: ${d.size}`);
  //});

  return groups;
}

function getWord(wordStat: Record<string, WordStat>): Word {
  console.time("next word");
  const groups = rebuildGroups(wordStat);
  const rndIdx = Math.floor(Math.random() * ALMOST_ONE * 10);
  let group: Set<Word> | null = null;
  for (let i = rndIdx; i >= 0; i--) {
    if (groups[i].size > 0) {
      group = groups[i];
    }
  }

  if (group == null) {
    for (let i = rndIdx; i <= 10; i++) {
      if (groups[i].size > 0) {
        group = groups[i];
      }
    }
  }

  if (group == null) throw new Error("impossible");

  const groupWords = Array.from(group);
  const wrdIndex = Math.floor(Math.random() * group.size * ALMOST_ONE);
  const rndWord = groupWords[wrdIndex];
  console.timeEnd("next word");
  return rndWord;
}

export function CardsPage() {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light", {
    getInitialValueInEffect: true,
  });

  const lock = useRef(false);

  useEffect(() => {
    if (lock.current === true) return;
    async function setUpDb() {
      console.log("hook");
      lock.current = true;
      if ((await db.system.count()) > 0) return;
      await db.system.add({ isInit: true });
      console.log(await db.system.toArray());
    }

    setUpDb();
  }, []);

  const [currentWord, setCurrentWord] = useState(() => getWord(wordStat));

  const wordObj = words.find((d) => d.word === currentWord)!;

  const handleSwipeLeft = (word: string) => {
    wordStat[word].rejects += 1;
    setCurrentWord(getWord(wordStat));
  };
  const handleSwipeRight = (word: string) => {
    wordStat[word].accepts += 1;
    setCurrentWord(getWord(wordStat));
  };

  const globalStat = words.reduce(
    (m, d) => {
      const stat = wordStat[d.word];
      const rate = getRate(stat);

      if (stat.accepts + stat.rejects >= 3) {
        if (rate > 0.8) {
          m.good += 1;
        } else {
          m.bad += 1;
        }
      } else if (stat.accepts + stat.rejects != 0) {
        m.seen += 1;
      }

      return m;
    },
    { good: 0, bad: 0, seen: 0 },
  );

  return (
    <Stack p="sm" pb="4px" h="100vh" style={{ overflow: "hidden" }}>
      <Group gap={0}>
        <Progress.Root size="xl" flex={1}>
          <Progress.Section
            value={(100 * globalStat.seen) / words.length}
            color="blue"
          ></Progress.Section>
          <Progress.Section
            value={(100 * globalStat.good) / words.length}
            color="green"
          ></Progress.Section>
          <Progress.Section
            value={(100 * globalStat.bad) / words.length}
            color="red"
          ></Progress.Section>
        </Progress.Root>
        <ActionIcon
          ml="auto"
          size="xl"
          aria-aria-label="Toggle color scheme"
          variant="transparent"
          onClick={() =>
            setColorScheme(computedColorScheme === "light" ? "dark" : "light")
          }
        >
          <IconSun className={classes.light} />
          <IconMoon className={classes.dark} />
        </ActionIcon>
      </Group>
      <Center flex={1} pos="relative">
        <AnimatedCard
          onSwipeLeft={handleSwipeLeft}
          onSwipeRight={handleSwipeRight}
          word={currentWord}
          wordObj={wordObj}
          key={currentWord}
          stat={wordStat[currentWord]}
        />
      </Center>
      <Center>
        <Anchor
          size="sm"
          underline="not-hover"
          href={`${homepage}/deployments`}
        >
          v{version}
        </Anchor>
      </Center>
    </Stack>
  );
}
