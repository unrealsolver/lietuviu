import Dexie, { type EntityTable } from "dexie";

const db = new Dexie("ltkdb") as Dexie & {
  system: EntityTable<{ isInit: boolean }>;
};

db.version(1).stores({
  system: "++pk,isInit",
});

export { db };
