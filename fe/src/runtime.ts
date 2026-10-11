export type Freshness = 'fresh' | 'stale' | 'unavailable';

export interface RuntimePod {
  uid: string;
  name: string;
  version: string | null;
  revision: string | null;
  trafficRole: 'active' | 'preview' | 'inactive';
  phase: string;
  ready: boolean;
  terminating: boolean;
  restartCount: number;
  metrics: {
    status: Freshness;
    observedAt: string | null;
    windowSeconds: number | null;
    cpuMillicores: number | null;
    memoryBytes: number | null;
  };
  resources: {
    cpuRequestMillicores: number | null;
    cpuLimitMillicores: number | null;
    memoryRequestBytes: number | null;
    memoryLimitBytes: number | null;
  };
}

export interface RuntimeSnapshot {
  inventoryStatus: Freshness;
  inventoryObservedAt: string | null;
  pods: RuntimePod[];
}

const freshness = (v: unknown): v is Freshness => ['fresh', 'stale', 'unavailable'].includes(String(v));
const nullableNumber = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0);
const timestamp = (v: unknown) => v === null || (typeof v === 'string' && Number.isFinite(Date.parse(v)));
const nullableText = (v: unknown) => v === null || typeof v === 'string';

// Reject old single-Pod metrics or proxy error pages instead of replacing the inventory.
export function parseRuntimeSnapshot(value: unknown): RuntimeSnapshot {
  if (!value || typeof value !== 'object') throw new Error('Invalid runtime response');
  const data = value as RuntimeSnapshot;
  if (!freshness(data.inventoryStatus) || !timestamp(data.inventoryObservedAt) || !Array.isArray(data.pods) ||
      !data.pods.every((p) => p && typeof p.uid === 'string' && typeof p.name === 'string' &&
        nullableText(p.version) && nullableText(p.revision) && typeof p.phase === 'string' &&
        ['active', 'preview', 'inactive'].includes(p.trafficRole) && typeof p.ready === 'boolean' &&
        typeof p.terminating === 'boolean' && typeof p.restartCount === 'number' && nullableNumber(p.restartCount) &&
        p.metrics && freshness(p.metrics.status) && timestamp(p.metrics.observedAt) &&
        [p.metrics.cpuMillicores, p.metrics.memoryBytes, p.metrics.windowSeconds].every(nullableNumber) &&
        p.resources && [p.resources.cpuRequestMillicores, p.resources.cpuLimitMillicores,
          p.resources.memoryRequestBytes, p.resources.memoryLimitBytes].every(nullableNumber) &&
        (p.metrics.status === 'unavailable' || (p.metrics.observedAt !== null &&
          p.metrics.cpuMillicores !== null && p.metrics.memoryBytes !== null &&
          p.metrics.windowSeconds !== null && p.metrics.windowSeconds > 0))) ||
      (data.inventoryStatus !== 'unavailable' && data.inventoryObservedAt === null)) {
    throw new Error('Invalid runtime response');
  }
  return data;
}

export function isStale(status: Freshness, observedAt: string | null, now: number, ttl: number) {
  return status === 'stale' || (observedAt !== null && now - Date.parse(observedAt) > ttl);
}

export function formatCpu(value: number | null) {
  return value === null ? '—' : `${Number(value.toFixed(2))}m`;
}

export function formatMemory(value: number | null) {
  return value === null ? '—' : `${Number((value / 2 ** 20).toFixed(1))} MiB`;
}
