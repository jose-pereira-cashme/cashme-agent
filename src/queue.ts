export interface Queue {
  enqueue(issueKey: string): void;
  size(): number;
}

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
        try {
          await worker(issueKey);
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
      if (known.has(issueKey)) return;
      known.add(issueKey);
      pending.push(issueKey);
      void drain();
    },
    size() {
      return pending.length;
    },
  };
}
