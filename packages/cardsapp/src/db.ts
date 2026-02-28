import Dexie, { type EntityTable, type Table } from "dexie";

export type SwipeStat = {
  bankId: string;
  bankVer: string;
  input: string;
  left: number;
  right: number;
};

const db = new Dexie("ltkdb") as Dexie & {
  system: EntityTable<{ isInit: boolean }>;
  swipeStats: Table<SwipeStat, [string, string, string]>;
};

db.version(1).stores({
  system: "++pk,isInit",
});

db.version(2).stores({
  system: "++pk,isInit",
  swipeStats: "[bankId+bankVer+input],[bankId+bankVer],bankId,bankVer,input",
});

export { db };
