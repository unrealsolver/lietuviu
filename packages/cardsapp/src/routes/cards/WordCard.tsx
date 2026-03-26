import { CardFace } from "./CardFace";
import { InteractiveCard } from "./InteractiveCard";
import type { WordStat } from "./util";
import type { OutputBankItem, OutputBankReader } from "@ltk/processing";
import { Stack, Title } from "@mantine/core";

type WordCardProps = {
  word: string;
  item: OutputBankItem;
  bankView: OutputBankReader;
  onSwipeLeft: (word: string) => void;
  onSwipeRight: (word: string) => void;
  stat: WordStat;
};

export function WordCard({
  word,
  item,
  bankView,
  onSwipeLeft,
  onSwipeRight,
  stat,
}: WordCardProps) {
  const accent = readAccent(bankView, item);
  const translation = readTranslation(bankView, item);

  return (
    <InteractiveCard
      front={
        <CardFace>
          <Title ta="center" order={1}>
            {word}
          </Title>
        </CardFace>
      }
      back={
        <CardFace>
          <Stack align="center">
            <Title order={1} ta="center" ff="serif">
              {accent}
            </Title>
            <Title order={2} ta="center">
              {translation}
            </Title>
            <Title order={1} ta="center">
              {stat.accepts} / {stat.rejects}
            </Title>
          </Stack>
        </CardFace>
      }
      onSwipeLeft={() => onSwipeLeft(word)}
      onSwipeRight={() => onSwipeRight(word)}
    />
  );
}

function readAccent(view: OutputBankReader, item: OutputBankItem): string {
  const output = view.resolveFeatureOutput(item, "PHONETICS");
  if (!Array.isArray(output) || output.length === 0) {
    return item.input;
  }

  const pieces = output
    .map((piece) => (typeof piece === "string" ? piece : piece.accented))
    .filter((piece) => piece.length > 0);

  return pieces.length > 0 ? pieces.join(" ") : item.input;
}

function readTranslation(view: OutputBankReader, item: OutputBankItem): string {
  const output = view.resolveFeatureOutput(item, "TRANSLATION");
  if (typeof output === "string") {
    return output;
  }
  if (output != null && typeof output.translatedText === "string") {
    return output.translatedText;
  }
  return "";
}
