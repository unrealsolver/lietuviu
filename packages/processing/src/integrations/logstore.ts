import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type ApiCallLog = {
  key: string;
  ts: string;
  provider?: string;
  input: string;
  operation?: string;
  cacheSchema?: string;
  cacheIdentity?: Record<string, unknown>;
  status: "ok" | "error";
  request?: unknown;
  response?: unknown;
  error?: unknown;
  durationMs: number;
};

export type LogStore = {
  get(key: string): Promise<ApiCallLog | null>;
  put(record: ApiCallLog): Promise<void>;
};

export type FileJsonlLogStoreOptions = {
  filePath: string;
};

export class FileJsonlLogStore implements LogStore {
  private readonly filePath: string;
  private readonly index: Map<string, ApiCallLog>;

  private constructor(filePath: string, index: Map<string, ApiCallLog>) {
    this.filePath = filePath;
    this.index = index;
  }

  static async create(
    options: FileJsonlLogStoreOptions,
  ): Promise<FileJsonlLogStore> {
    const filePath = options.filePath;
    await mkdir(dirname(filePath), { recursive: true });

    const index = new Map<string, ApiCallLog>();
    const content = await readFile(filePath, "utf8").catch(
      (err: NodeJS.ErrnoException) => {
        if (err.code === "ENOENT") {
          return "";
        }
        throw err;
      },
    );

    for (const line of content.split("\n")) {
      if (!line.trim()) {
        continue;
      }

      try {
        const parsed = JSON.parse(line) as ApiCallLog;
        if (typeof parsed.key === "string" && parsed.key.length > 0) {
          index.set(parsed.key, parsed);
        }
      } catch {
        // Ignore malformed lines and keep loading the rest of the log.
      }
    }

    return new FileJsonlLogStore(filePath, index);
  }

  async get(key: string): Promise<ApiCallLog | null> {
    return this.index.get(key) ?? null;
  }

  async put(record: ApiCallLog): Promise<void> {
    this.index.set(record.key, record);
    await appendFile(this.filePath, `${JSON.stringify(record)}\n`, "utf8");
  }
}

export async function createBankLogStore(
  bankLogDir: string,
  logFileName = "api-calls.log.jsonl",
): Promise<LogStore> {
  return FileJsonlLogStore.create({
    filePath: join(bankLogDir, logFileName),
  });
}
