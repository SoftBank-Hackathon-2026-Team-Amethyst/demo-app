import { extname, join } from 'node:path';
import { Worker } from 'node:worker_threads';

interface Result { elapsedMs: number; checksum: string }
interface Task {
  iterations: number;
  resolve: (result: Result) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class LoadError extends Error {
  constructor(message: string, public statusCode: number) { super(message); }
}

// One reusable CPU worker per pod, with a bounded queue and total request deadline.
export class CpuPool {
  private worker?: Worker;
  private active?: Task;
  private queue: Task[] = [];
  private closed = false;

  constructor(private maxPending = 8, private timeoutMs = 2000) {}

  run(iterations: number): Promise<Result> {
    if (this.closed) return Promise.reject(new LoadError('CPU worker is closed', 503));
    if (this.queue.length + (this.active ? 1 : 0) >= this.maxPending) {
      return Promise.reject(new LoadError('CPU load queue is full', 429));
    }
    return new Promise((resolve, reject) => {
      const task: Task = {
        iterations, resolve, reject,
        timer: setTimeout(() => {
          if (this.active === task) {
            void this.reset(new LoadError('CPU work timed out', 503));
          } else {
            this.queue = this.queue.filter((entry) => entry !== task);
            reject(new LoadError('CPU work timed out in queue', 503));
          }
        }, this.timeoutMs),
      };
      this.queue.push(task);
      this.dispatch();
    });
  }

  private dispatch() {
    if (this.active || this.closed || !this.queue.length) return;
    if (!this.worker) {
      // .ts under tsx in development/tests; compiled .js in the runtime image.
      const worker = new Worker(join(__dirname, `cpu-worker${extname(__filename)}`));
      this.worker = worker;
      worker.on('message', (result: Result) => {
        if (this.worker !== worker || !this.active) return;
        const task = this.active;
        this.active = undefined;
        clearTimeout(task.timer);
        task.resolve(result);
        this.dispatch();
      });
      worker.on('error', () => {
        if (this.worker === worker) void this.reset(new LoadError('CPU worker failed', 503));
      });
      worker.on('exit', () => {
        if (this.worker === worker) void this.reset(new LoadError('CPU worker exited', 503));
      });
    }
    this.active = this.queue.shift()!;
    this.worker.postMessage(this.active.iterations);
  }

  private async reset(error: Error) {
    const worker = this.worker;
    this.worker = undefined;
    for (const task of [...(this.active ? [this.active] : []), ...this.queue]) {
      clearTimeout(task.timer);
      task.reject(error);
    }
    this.active = undefined;
    this.queue = [];
    await worker?.terminate();
  }

  async close() {
    this.closed = true;
    await this.reset(new LoadError('CPU worker is closed', 503));
  }
}
