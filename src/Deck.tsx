import {AnimatedCard} from "./AnimatedCard";
import _words from "./words.json";
import { useState } from "react";

const words: string[] = _words;

export function Deck() {
  const [cardIdx, setCardIdx] = useState(0);

  const handleSwipe = () => setCardIdx((d) => d + 1);

  const word = words[cardIdx];
  if (word == null) return null;

  return <AnimatedCard onSwipe={handleSwipe} word={word} key={word} />;
}
