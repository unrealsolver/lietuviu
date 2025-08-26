import type {BankPrototype} from "./types";

export type Events = {
  onProgress?: (name: string, completed: number) => void;
};

export type Mode = {name: string} 

export type Context<T extends Mode = Mode> = {
  mode: T,
  bank: BankPrototype,
  cache: RawData<any>[],
}

export type RawData<T> = {
  /** input word/phrase */
  word: string;
  data: T;
}

export type Handler<T> = {
  name: string;
  handle: (context: Context, events: Events) => T
}
