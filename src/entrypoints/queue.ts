export type Queue = {
  enqueue(issueKey: string): void;
  size(): number;
};

export function createQueue(worker: (issueKey: string) => Promise<void>): Queue {
  const pending: string[] = [];
  const known = new Set<string>(); // keys queued or currently processing
  let draining = false;

  async function drain(): Promise<void> {
    if (draining) return;
    draining = true;
    try {
      while (pending.length > 0) {
        const issueKey = pending.shift()!;
        console.log(`[queue] processing ${issueKey} (${pending.length} remaining)`);
        try {
          await worker(issueKey);
          console.log(`[queue] done ${issueKey}`);
        } catch (err) {
          console.error(`[queue] failed processing ${issueKey}: ${(err as Error).message}`);
        } finally {
          known.delete(issueKey);
        }
      }
    } finally {
      draining = false;
    }
  }

  return {
    enqueue(issueKey) {
      if (known.has(issueKey)) {
        console.log(`[queue] skip ${issueKey} — already queued or processing`);
        return;
      }
      known.add(issueKey);
      pending.push(issueKey);
      console.log(`[queue] enqueued ${issueKey} (${pending.length} pending)`);
      void drain();
    },
    size() {
      return pending.length;
    },
  };
}
