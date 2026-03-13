const SLOW_THRESHOLD_MS = 3000;

interface TimingEntry {
  label: string;
  durationMs: number;
}

export class PerfTimer {
  private entries: TimingEntry[] = [];
  private start: number;

  constructor() {
    this.start = performance.now();
  }

  async measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const t0 = performance.now();
    const result = await fn();
    const durationMs = Math.round(performance.now() - t0);
    this.entries.push({ label, durationMs });
    return result;
  }

  finish(): { totalMs: number; entries: TimingEntry[]; slow: boolean } {
    const totalMs = Math.round(performance.now() - this.start);
    const slow = totalMs > SLOW_THRESHOLD_MS;

    if (slow) {
      console.warn(
        `[PERF] Slow request: ${totalMs}ms (threshold: ${SLOW_THRESHOLD_MS}ms)`,
        this.entries
      );
    } else if (process.env.NODE_ENV === "development") {
      console.log(`[PERF] ${totalMs}ms`, this.entries);
    }

    return { totalMs, entries: this.entries, slow };
  }
}
