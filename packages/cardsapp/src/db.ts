import type { OutputBank } from "@ltk/processing";
import Dexie, { type EntityTable, type Table } from "dexie";
import { useEffect, useState } from "react";

export type SwipeStat = {
  bankId: string;
  input: string;
  left: number;
  right: number;
};

export type Databank = {
  name: string;
  id: string;
  version: string;
  data: OutputBank;
};

const APP_DB_NAME = "ltkdb";
const SYSTEM_DB_NAME = "ltkdb-system";
export const APP_WIPE_VERSION = 1;

type SystemMeta =
  | {
      key: "wipe";
      lastWipeVersion: number;
      updatedAt: string;
    }
  | {
      key: "startup-ack";
      updatedAt: string;
    };

const db = new Dexie(APP_DB_NAME) as Dexie & {
  swipeStats: Table<SwipeStat, [string, string]>;
  databanks: Table<Databank, [string, string]>;
};

db.version(1).stores({
  swipeStats: "[bankId+input],bankId,input",
  databanks: "[id+version],id,version",
});

const systemDb = new Dexie(SYSTEM_DB_NAME) as Dexie & {
  meta: EntityTable<SystemMeta, "key">;
};

systemDb.version(1).stores({
  meta: "key",
});

export async function isFirstStartUp() {
  return (await systemDb.meta.get("startup-ack")) == null;
}

export async function acknowledgeFirstStartUp(): Promise<void> {
  await systemDb.meta.put({
    key: "startup-ack",
    updatedAt: new Date().toISOString(),
  });
}

export function useIsFirstStartUp() {
  const [state, setState] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    isFirstStartUp()
      .then((value) => {
        if (!cancelled) setState(value);
      })
      .catch(() => {
        if (!cancelled) setState(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export async function isDbWipeRequired(): Promise<boolean> {
  const wipeMeta = await systemDb.meta.get("wipe");
  const lastWipeVersion = wipeMeta?.lastWipeVersion ?? 0;
  return lastWipeVersion < APP_WIPE_VERSION;
}

export async function shouldConfirmDbWipe(): Promise<boolean> {
  if (!(await isDbWipeRequired())) {
    return false;
  }

  try {
    return (await db.swipeStats.count()) > 0;
  } catch {
    // If DB state cannot be inspected reliably, prefer explicit user confirmation.
    return true;
  }
}

export async function ensureDbReady(): Promise<void> {
  if (!(await isDbWipeRequired())) {
    return;
  }

  await hardResetAppDb();
}

export async function hardResetAppDb(): Promise<void> {
  db.close();
  await Dexie.delete(APP_DB_NAME);
  await systemDb.meta.put({
    key: "wipe",
    lastWipeVersion: APP_WIPE_VERSION,
    updatedAt: new Date().toISOString(),
  });
}

export { db };
