import { mapLimit } from "async-es";
import {fetchTextAccents, fetchWordAccents, type TextAccents, type WordAccent} from "./api";
import type {Context, Events, Handler} from "../handler";


export async function handle(context: Context, events: Events) {
  let completed = 0;
  return await mapLimit(context.bank.data, 3, async (phrase: string) => {
    const cached = context.cache.find((d) => d.word === phrase)

    if (cached != null) {
      return cached
    }

    const wordsPerPhrase = phrase.split(/\s+/).length
    const q: [Promise<TextAccents>, Promise<WordAccent>?] = [fetchTextAccents(phrase)]

    if (wordsPerPhrase == 1) {
      // Remove garbage
      q.push(fetchWordAccents(phrase.trim().replace(/^[\s.!]+|[\s.!]+$/gu, '')))
    }

    const [textRes, wordRes] = await Promise.all(q)
    completed++;

    if (events.onProgress != null) {
      events.onProgress("Kirčiuoklis", completed);
    }

    return {
      word: phrase,
      data: {
        text: textRes,
        word: wordRes,
      },
    }
  });
}

export const handler: Handler<ReturnType<typeof handle>> = {
  name: 'accents',
  handle
}
