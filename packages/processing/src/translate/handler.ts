import type {Context, Events, Handler} from "../handler";
import { fetchTranslate } from "./api";
import { mapLimit } from "async-es";

export async function handle(context: Context, events: Events) {
  let completed = 0;
  return await mapLimit(context.bank.data, 8, async (phrase: string) => {
    const cached = context.cache.find((d) => d.word === phrase)

    if (cached != null) {
      return cached
    }

    const res = await fetchTranslate(phrase);
    completed++;
    if (events.onProgress != null) {
      events.onProgress("Translations", completed);
    }
    return {
      word: phrase,
      data: res,
    };
  });
}

export const handler: Handler<ReturnType<typeof handle>> = {
  name: 'translate',
  handle,
}
