import React, { useEffect, useState } from 'react';
import { translations, type Language } from './i18n';
import { formatCpu, formatMemory, isStale, parseRuntimeSnapshot, type RuntimeSnapshot } from './runtime';

interface Props {
  lang: Language;
  now: number;
  colorForHost: (name: string) => string;
}

export function RuntimePodCards({ snapshot, failed, lang, now, colorForHost }: Props & {
  snapshot: RuntimeSnapshot | null;
  failed: boolean;
}) {
  const t = translations[lang].runtime;
  const inventoryStale = failed || (snapshot && isStale(snapshot.inventoryStatus, snapshot.inventoryObservedAt, now, 15000));
  const pods = snapshot?.pods ?? [];
  const ready = pods.filter((p) => p.ready && !p.terminating).length;
  return (
    <div>
      {snapshot && <p className="text-sm text-muted mb-3">{t.readyCount(ready, pods.length)}</p>}
      {(failed || inventoryStale) && <p role="status" className="text-sm text-amber-700 mb-3">{t.inventoryDelayed}</p>}
      {pods.length === 0 ? (
        <p className="py-8 text-center text-base text-muted">
          {snapshot?.inventoryStatus === 'fresh' && !failed ? t.noPods : failed ? t.unavailable : t.collecting}
        </p>
      ) : (
        <ul className="space-y-5">
          {pods.map((pod) => {
            const metricsStale = inventoryStale || isStale(pod.metrics.status, pod.metrics.observedAt, now, 45000);
            const hasMetrics = pod.metrics.status !== 'unavailable';
            const memoryLimit = pod.resources.memoryLimitBytes;
            return (
              <li key={pod.uid} className="rise">
                <div className="flex items-center justify-between mb-2 gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ background: colorForHost(pod.name) }} />
                    <span className="text-base font-semibold truncate" title={pod.name}>{pod.name}</span>
                  </div>
                  <span className="text-sm text-blue-700 shrink-0">{pod.version || '—'}</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted mb-2">
                  <span>{t.roles[pod.trafficRole]}</span>
                  <span>{pod.terminating ? t.terminating : pod.ready ? t.ready : t.notReady} · {pod.phase}</span>
                  <span>{t.restarts(pod.restartCount)}</span>
                </div>
                <div className={metricsStale ? 'opacity-50' : ''}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span>CPU</span>
                    <span className="font-semibold">{formatCpu(pod.metrics.cpuMillicores)}
                      <span className="font-normal text-muted"> · {t.request} {formatCpu(pod.resources.cpuRequestMillicores)}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm mt-1">
                    <span>{t.memory}</span>
                    <span className="font-semibold">{formatMemory(pod.metrics.memoryBytes)}
                      <span className="font-normal text-muted"> · {t.limit} {formatMemory(memoryLimit)}</span>
                    </span>
                  </div>
                  {pod.metrics.memoryBytes !== null && memoryLimit !== null && memoryLimit > 0 && (
                    <div className="h-2.5 rounded-full bg-line overflow-hidden mt-2" aria-label={t.memory}>
                      <div className="h-full rounded-full bg-sky-500 transition-[width] duration-700"
                        style={{ width: `${Math.min(100, pod.metrics.memoryBytes / memoryLimit * 100)}%` }} />
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted mt-2">
                  {!hasMetrics ? (pod.phase === 'Pending' ? t.collecting : t.unavailable) :
                    `${metricsStale ? `${t.metricsDelayed} · ` : ''}${t.observed} ${new Date(pod.metrics.observedAt!).toLocaleTimeString(lang === 'ko' ? 'ko-KR' : lang === 'ja' ? 'ja-JP' : 'en-US')}`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      {snapshot?.inventoryObservedAt && <p className="text-xs text-muted mt-3">
        {t.inventoryObserved} {new Date(snapshot.inventoryObservedAt).toLocaleTimeString(lang === 'ko' ? 'ko-KR' : lang === 'ja' ? 'ja-JP' : 'en-US')}
      </p>}
    </div>
  );
}

export default function RuntimePods(props: Props) {
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let inflight = false;
    let controller: AbortController | null = null;
    const poll = async () => {
      if (inflight) return;
      inflight = true;
      controller = new AbortController();
      const timer = setTimeout(() => controller?.abort(), 3500);
      try {
        const res = await fetch('/api/runtime', { cache: 'no-store', signal: controller.signal });
        if (!res.ok) throw new Error('Runtime API unavailable');
        const data = parseRuntimeSnapshot(await res.json());
        if (data.inventoryStatus === 'unavailable') throw new Error('Runtime inventory unavailable');
        if (!cancelled) { setSnapshot(data); setFailed(false); }
      } catch {
        if (!cancelled) setFailed(true); // Keep the last successful inventory.
      } finally {
        clearTimeout(timer);
        inflight = false;
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 5000);
    return () => { cancelled = true; clearInterval(timer); controller?.abort(); };
  }, []);
  return <RuntimePodCards {...props} snapshot={snapshot} failed={failed} />;
}
