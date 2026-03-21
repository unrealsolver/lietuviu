import { version, homepage } from "../../../package.json";
import { db, type Databank } from "../../db";
import { AnimatedCard } from "./AnimatedCard";
import classes from "./CardsPage.module.css";
import type { WordStat } from "./util";
import externalBank from "@ltk/databanks/a1.bank.json";
import {
  OutputBankReader,
  type OutputBank,
  type OutputBankItem,
} from "@ltk/processing";
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
import { useEffect, useMemo, useRef, useState } from "react";

type Word = string;

const ALMOST_ONE = 0.999999;

function createWordStat(items: OutputBankItem[]): Record<Word, WordStat> {
  return items.reduce(
    (m, d) => {
      m[d.input] = {
        accepts: 0,
        rejects: 0,
      };
      return m;
    },
    {} as Record<Word, WordStat>,
  );
}

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
  const wordStatRef = useRef<Record<Word, WordStat>>({});
  const [bankEntry, setBankEntry] = useState<Databank | null>(null);
  const [currentWord, setCurrentWord] = useState<string | null>(null);
  const [statsLoaded, setStatsLoaded] = useState(false);

  async function persistSwipe(
    bankId: string,
    input: string,
    direction: "left" | "right",
  ) {
    await db.transaction("rw", db.swipeStats, async () => {
      const key: [string, string] = [bankId, input];
      const current = await db.swipeStats.get(key);
      const next = {
        bankId,
        input,
        left: current?.left ?? 0,
        right: current?.right ?? 0,
      };
      if (direction === "left") {
        next.left += 1;
      } else {
        next.right += 1;
      }
      await db.swipeStats.put(next);
    });
  }

  useEffect(() => {
    if (lock.current === true) return;
    async function setUpDb() {
      lock.current = true;

      const resolvedBank = externalBank as OutputBank;
      const resolvedBankId = resolvedBank.id;
      const resolvedBankVersion = resolvedBank.version;
      const resolvedBankName = resolvedBank.title;
      await db.databanks.put({
        name: resolvedBankName,
        id: resolvedBankId,
        version: resolvedBankVersion,
        data: resolvedBank,
      });

      const activeBank = await db.databanks
        .where("[id+version]")
        .equals([resolvedBankId, resolvedBankVersion])
        .first();
      if (activeBank == null) {
        throw new Error("Failed to load databank from IndexedDB");
      }
      setBankEntry(activeBank);

      const wordStat = createWordStat(activeBank.data.data);
      const stats = await db.swipeStats
        .where("bankId")
        .equals(activeBank.id)
        .toArray();

      for (const row of stats) {
        const current = wordStat[row.input as Word];
        if (current == null) {
          continue;
        }
        current.rejects = row.left;
        current.accepts = row.right;
      }

      wordStatRef.current = wordStat;
      setCurrentWord(getWord(wordStat));
      setStatsLoaded(true);
    }

    setUpDb().catch((error) => {
      console.error("Failed to initialize swipe stats", error);
      setStatsLoaded(true);
    });
  }, []);

  const items = bankEntry?.data.data ?? [];
  const bankView = useMemo(() => {
    if (bankEntry == null) {
      return null;
    }
    return new OutputBankReader(bankEntry.data);
  }, [bankEntry]);

  const currentItem = useMemo(() => {
    if (currentWord == null) {
      return null;
    }
    return items.find((d) => d.input === currentWord) ?? null;
  }, [currentWord, items]);

  const handleSwipeLeft = (word: string) => {
    if (bankEntry == null) {
      return;
    }
    const stat = wordStatRef.current[word];
    if (stat == null) {
      return;
    }
    stat.rejects += 1;
    void persistSwipe(bankEntry.id, word, "left");
    setCurrentWord(getWord(wordStatRef.current));
  };
  const handleSwipeRight = (word: string) => {
    if (bankEntry == null) {
      return;
    }
    const stat = wordStatRef.current[word];
    if (stat == null) {
      return;
    }
    stat.accepts += 1;
    void persistSwipe(bankEntry.id, word, "right");
    setCurrentWord(getWord(wordStatRef.current));
  };

  if (
    !statsLoaded ||
    bankEntry == null ||
    bankView == null ||
    currentWord == null ||
    currentItem == null
  ) {
    return (
      <Stack p="sm" pb="4px" h="100vh" style={{ overflow: "hidden" }}>
        <Center flex={1}>Loading...</Center>
      </Stack>
    );
  }

  const globalStat = items.reduce(
    (m, d) => {
      const stat = wordStatRef.current[d.input];
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
            value={(100 * globalStat.seen) / items.length}
            color="blue"
          ></Progress.Section>
          <Progress.Section
            value={(100 * globalStat.good) / items.length}
            color="green"
          ></Progress.Section>
          <Progress.Section
            value={(100 * globalStat.bad) / items.length}
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
          item={currentItem}
          bankView={bankView}
          key={currentWord}
          stat={wordStatRef.current[currentWord]}
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
