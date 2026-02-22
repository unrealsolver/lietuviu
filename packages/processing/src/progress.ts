import type { ItemProgressEvent } from "./integrations";
import { clearScreenDown, moveCursor } from "node:readline";

type RowState = {
  label: string;
  total: number;
  done: number;
  // 0=empty, 1=passed, 2=replayed, 3=partial replay, 4=skipped, 5=error
  buckets: number[];
};

type ProgressRendererOptions = {
  interactive?: boolean;
  enabled?: boolean;
  useColors?: boolean;
  minRenderIntervalMs?: number;
  now?: () => number;
  write?: (text: string) => void;
};

export class ProgressRenderer {
  private readonly enabled: boolean;
  private readonly interactive: boolean;
  private readonly useColors: boolean;
  private readonly minRenderIntervalMs: number;
  private readonly now: () => number;
  private readonly write: (text: string) => void;
  private readonly rows = new Map<string, RowState>();
  private order: string[] = [];
  private lastLineCount = 0;
  private readonly plainLogStepByFeature = new Map<string, number>();
  private lastRenderAt = Number.NEGATIVE_INFINITY;

  constructor(options: ProgressRendererOptions = {}) {
    this.interactive = options.interactive ?? process.stdout.isTTY === true;
    this.enabled = options.enabled ?? process.env.NO_PROGRESS !== "1";
    this.useColors =
      options.useColors ?? (this.interactive && process.env.NO_COLOR == null);
    this.minRenderIntervalMs = options.minRenderIntervalMs ?? 1000;
    this.now = options.now ?? Date.now;
    this.write = options.write ?? ((text) => process.stdout.write(text));
  }

  update(event: ItemProgressEvent): void {
    if (!this.enabled) {
      return;
    }
    const label = event.featureId || event.pluginName;
    const width = this.resolveBarWidth(label, event.total);
    const existing = this.rows.get(event.featureId);
    const row: RowState = existing ?? {
      label,
      total: event.total,
      done: 0,
      buckets: new Array(width).fill(0),
    };

    if (row.buckets.length !== width) {
      row.buckets = this.resizeBuckets(row.buckets, width);
    }

    row.total = event.total;
    row.done = Math.max(row.done, event.done);
    this.applyBucketState(row, event.index, event.outcome);

    if (existing == null) {
      this.rows.set(event.featureId, row);
      this.order.push(event.featureId);
    }

    const forceRender = event.done >= event.total;
    const nowTs = this.now();
    if (!forceRender && nowTs - this.lastRenderAt < this.minRenderIntervalMs) {
      return;
    }
    this.lastRenderAt = nowTs;

    if (this.interactive) {
      this.render();
      return;
    }
    this.renderPlain(event, row);
  }

  stop(options: { clear?: boolean } = {}): void {
    if (!this.enabled) {
      return;
    }

    if (this.interactive && options.clear === true && this.lastLineCount > 0) {
      moveCursor(process.stdout, 0, -this.lastLineCount);
      clearScreenDown(process.stdout);
    }

    this.lastLineCount = 0;
    this.rows.clear();
    this.order = [];
    this.plainLogStepByFeature.clear();
    this.lastRenderAt = Number.NEGATIVE_INFINITY;
  }

  private render(): void {
    const lines = this.order
      .map((id) => this.rows.get(id))
      .filter((row): row is RowState => row != null)
      .map((row) => this.renderRow(row));

    if (this.lastLineCount > 0) {
      moveCursor(process.stdout, 0, -this.lastLineCount);
      clearScreenDown(process.stdout);
    }

    this.write(`${lines.join("\n")}\n`);
    this.lastLineCount = lines.length;
  }

  private renderPlain(event: ItemProgressEvent, row: RowState): void {
    const featureId = event.featureId;
    const step =
      this.plainLogStepByFeature.get(featureId) ??
      Math.max(1, Math.ceil(row.total / 20));
    const shouldPrint =
      row.done === 1 ||
      row.done % step === 0 ||
      row.done === row.total ||
      event.outcome === "ERROR" ||
      event.outcome === "SKIPPED";
    if (!shouldPrint) {
      return;
    }
    const pct =
      row.total === 0 ? 100 : Math.floor((row.done / row.total) * 100);
    const bar = this.renderBar(this.resizeBuckets(row.buckets, 30), 30);
    this.write(`${row.label} ${bar} ${row.done}/${row.total} ${pct}%\n`);
    this.plainLogStepByFeature.set(featureId, step);
  }

  private renderRow(row: RowState): string {
    const left = this.fitLeft(row.label);
    const pct =
      row.total === 0 ? 100 : Math.floor((row.done / row.total) * 100);
    const right = `${row.done}/${row.total} ${pct}%`;
    const barWidth = this.resolveBarWidth(left, row.total);
    const bar = this.renderBar(row.buckets, barWidth);
    return `${left} ${bar} ${right}`;
  }

  private renderBar(sourceBuckets: number[], width: number): string {
    const buckets =
      sourceBuckets.length === width
        ? sourceBuckets
        : this.resizeBuckets(sourceBuckets, width);
    return buckets
      .map((state) => {
        if (state === 5) {
          return this.colorize("✖", "red");
        }
        if (state === 4) {
          return this.colorize("▶", "yellow");
        }
        if (state === 3) {
          return this.colorize("▞", "cyan");
        }
        if (state === 2) {
          return this.colorize("▞", "blue");
        }
        if (state === 1) {
          return this.colorize("█", "green");
        }
        return "·";
      })
      .join("");
  }

  private resolveBarWidth(pluginName: string, total: number): number {
    const cols = process.stdout.columns ?? 100;
    const left = this.fitLeft(pluginName);
    const right = `${total}/${total} 100%`;
    return Math.max(10, cols - left.length - right.length - 2);
  }

  private fitLeft(name: string): string {
    const maxLeft = 18;
    if (name.length <= maxLeft) {
      return name.padEnd(maxLeft, " ");
    }
    return `${name.slice(0, maxLeft - 1)}…`;
  }

  private applyBucketState(
    row: RowState,
    itemIndex: number,
    outcome: ItemProgressEvent["outcome"],
  ): void {
    const width = row.buckets.length;
    if (row.total <= 0 || width <= 0) {
      return;
    }
    const bucket = Math.min(
      width - 1,
      Math.floor((itemIndex * width) / row.total),
    );
    const priority =
      outcome === "ERROR"
        ? 5
        : outcome === "SKIPPED"
          ? 4
          : outcome === "PARTIAL_REPLAY"
            ? 3
            : outcome === "REPLAYED"
              ? 2
              : 1;
    row.buckets[bucket] = Math.max(row.buckets[bucket] ?? 0, priority);
  }

  private resizeBuckets(oldBuckets: number[], newWidth: number): number[] {
    if (newWidth <= 0) {
      return [];
    }
    if (oldBuckets.length === 0) {
      return new Array(newWidth).fill(0);
    }

    const resized = new Array(newWidth).fill(0);
    for (let i = 0; i < newWidth; i += 1) {
      const start = Math.floor((i * oldBuckets.length) / newWidth);
      const end = Math.max(
        start + 1,
        Math.floor(((i + 1) * oldBuckets.length) / newWidth),
      );
      let max = 0;
      for (let j = start; j < end; j += 1) {
        max = Math.max(max, oldBuckets[j] ?? 0);
      }
      resized[i] = max;
    }
    return resized;
  }

  private colorize(
    text: string,
    tone: "red" | "yellow" | "green" | "cyan" | "blue",
  ): string {
    if (!this.useColors) {
      return text;
    }
    const code =
      tone === "red"
        ? "\u001b[31m"
        : tone === "yellow"
          ? "\u001b[33m"
          : tone === "green"
            ? "\u001b[32m"
            : tone === "cyan"
              ? "\u001b[36m"
              : "\u001b[34m";
    return `${code}${text}\u001b[0m`;
  }
}
