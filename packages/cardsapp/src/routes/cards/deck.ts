import type { SwipeStat } from "../../db";
import type { WordStat } from "./util";
import type { OutputBankItem } from "@ltk/processing";

type Word = string;

const ALMOST_ONE = 0.999999;

export type DeckProgress = {
  good: number;
  bad: number;
  seen: number;
};

export function buildWordStats(
  items: OutputBankItem[],
): Record<Word, WordStat> {
  return items.reduce(
    (statsByWord, item) => {
      statsByWord[item.input] = { accepts: 0, rejects: 0 };
      return statsByWord;
    },
    {} as Record<Word, WordStat>,
  );
}

export function hydrateWordStats(
  items: OutputBankItem[],
  swipeStats: SwipeStat[],
): Record<Word, WordStat> {
  const wordStats = buildWordStats(items);

  for (const row of swipeStats) {
    const current = wordStats[row.input];
    if (current == null) {
      continue;
    }

    current.rejects = row.left;
    current.accepts = row.right;
  }

  return wordStats;
}

export function recordSwipe(
  wordStats: Record<Word, WordStat>,
  word: Word,
  direction: "left" | "right",
): boolean {
  const current = wordStats[word];
  if (current == null) {
    return false;
  }

  if (direction === "left") {
    current.rejects += 1;
  } else {
    current.accepts += 1;
  }

  return true;
}

export function summarizeDeckProgress(
  items: OutputBankItem[],
  wordStats: Record<Word, WordStat>,
): DeckProgress {
  return items.reduce(
    (summary, item) => {
      const stat = wordStats[item.input];
      if (stat == null) {
        return summary;
      }

      const totalSwipes = stat.accepts + stat.rejects;
      const rate = getSuccessRate(stat);

      if (totalSwipes >= 3) {
        if (rate > 0.8) {
          summary.good += 1;
        } else {
          summary.bad += 1;
        }
      } else if (totalSwipes > 0) {
        summary.seen += 1;
      }

      return summary;
    },
    { good: 0, bad: 0, seen: 0 },
  );
}

export function pickNextWord(wordStats: Record<Word, WordStat>): Word {
  const groups = groupWordsBySuccessRate(wordStats);
  const randomGroupIndex = Math.floor(Math.random() * ALMOST_ONE * 10);
  const preferredGroup = findNearestNonEmptyGroup(groups, randomGroupIndex);

  if (preferredGroup == null) {
    throw new Error("Word deck is empty");
  }

  const words = Array.from(preferredGroup);
  const randomWordIndex = Math.floor(
    Math.random() * preferredGroup.size * ALMOST_ONE,
  );
  return words[randomWordIndex];
}

function getSuccessRate(stat: WordStat) {
  return stat.rejects > 0
    ? stat.accepts / (stat.accepts + stat.rejects)
    : stat.accepts > 0
      ? 1
      : 0;
}

function groupWordsBySuccessRate(
  wordStats: Record<Word, WordStat>,
): Array<Set<Word>> {
  const groups = Array.from({ length: 10 }, () => new Set<Word>());

  for (const [word, stat] of Object.entries(wordStats)) {
    const normalizedRate = getSuccessRate(stat) * ALMOST_ONE;
    const groupIndex = Math.floor(normalizedRate * 10);
    groups[groupIndex].add(word);
  }

  return groups;
}

function findNearestNonEmptyGroup(
  groups: Array<Set<Word>>,
  startIndex: number,
): Set<Word> | null {
  for (let index = startIndex; index >= 0; index -= 1) {
    if (groups[index].size > 0) {
      return groups[index];
    }
  }

  for (let index = startIndex + 1; index < groups.length; index += 1) {
    if (groups[index].size > 0) {
      return groups[index];
    }
  }

  return null;
}
