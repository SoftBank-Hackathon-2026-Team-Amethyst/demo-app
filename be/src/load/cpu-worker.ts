import { createHash } from 'node:crypto';
import { parentPort } from 'node:worker_threads';

// Fixed work per request: adding replicas distributes the same total CPU demand.
parentPort!.on('message', (iterations: number) => {
  const start = performance.now();
  let digest = Buffer.alloc(32, 1);
  for (let i = 0; i < iterations; i++) {
    digest = createHash('sha256').update(digest).digest();
  }
  parentPort!.postMessage({ elapsedMs: performance.now() - start, checksum: digest.toString('hex') });
});
