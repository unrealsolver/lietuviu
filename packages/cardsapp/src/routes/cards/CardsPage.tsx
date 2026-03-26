import { version, homepage } from "../../../package.json";
import { db, type Databank } from "../../db";
import { CardsScaffold } from "./CardsScaffold";
import { WordCard } from "./WordCard";
import {
  hydrateWordStats,
  pickNextWord,
  recordSwipe,
  summarizeDeckProgress,
} from "./deck";
import type { WordStat } from "./util";
import externalBank from "@ltk/databanks/a1.bank.json";
import { OutputBankReader, type OutputBank } from "@ltk/processing";
import { Anchor, Center, Group, Progress } from "@mantine/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

type Word = string;

export function CardsPage() {
  const isInitializingRef = useRef(false);
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
    if (isInitializingRef.current) {
      return;
    }

    async function setUpDb() {
      isInitializingRef.current = true;

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

      const stats = await db.swipeStats
        .where("bankId")
        .equals(activeBank.id)
        .toArray();
      const wordStat = hydrateWordStats(activeBank.data.data, stats);
      wordStatRef.current = wordStat;
      setCurrentWord(pickNextWord(wordStat));
      setStatsLoaded(true);
    }

    setUpDb().catch((error) => {
      console.error("Failed to initialize swipe stats", error);
      setStatsLoaded(true);
    });
  }, []);

  const items = useMemo(() => bankEntry?.data.data ?? [], [bankEntry]);
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
    if (!recordSwipe(wordStatRef.current, word, "left")) {
      return;
    }
    void persistSwipe(bankEntry.id, word, "left");
    setCurrentWord(pickNextWord(wordStatRef.current));
  };

  const handleSwipeRight = (word: string) => {
    if (bankEntry == null) {
      return;
    }
    if (!recordSwipe(wordStatRef.current, word, "right")) {
      return;
    }
    void persistSwipe(bankEntry.id, word, "right");
    setCurrentWord(pickNextWord(wordStatRef.current));
  };

  if (
    !statsLoaded ||
    bankEntry == null ||
    bankView == null ||
    currentWord == null ||
    currentItem == null
  ) {
    return (
      <CardsScaffold>
        <Center flex={1}>Loading...</Center>
      </CardsScaffold>
    );
  }

  const deckProgress = summarizeDeckProgress(items, wordStatRef.current);

  return (
    <CardsScaffold
      header={
        <Progress.Root size="xl" flex={1}>
          <Progress.Section
            value={(100 * deckProgress.seen) / items.length}
            color="blue"
          />
          <Progress.Section
            value={(100 * deckProgress.good) / items.length}
            color="green"
          />
          <Progress.Section
            value={(100 * deckProgress.bad) / items.length}
            color="red"
          />
        </Progress.Root>
      }
      footer={
        <Group gap="xs">
          <Anchor
            size="sm"
            underline="not-hover"
            component={Link}
            to="/cards/tutorial"
          >
            Interactive guide
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
      <WordCard
        onSwipeLeft={handleSwipeLeft}
        onSwipeRight={handleSwipeRight}
        word={currentWord}
        item={currentItem}
        bankView={bankView}
        key={currentWord}
        stat={wordStatRef.current[currentWord]}
      />
    </CardsScaffold>
  );
}
