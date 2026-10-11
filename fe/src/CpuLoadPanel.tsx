import { useEffect, useState } from 'react';
import type { Translations } from './i18n';

interface Config { enabled: boolean; maxRps: number; maxDurationSec: number }
interface Stats { sent: number; ok: number; failed: number; limited: number; skipped: number; elapsed: number }
const EMPTY: Stats = { sent: 0, ok: 0, failed: 0, limited: 0, skipped: 0, elapsed: 0 };

export function CpuLoadPanel({ text, resetKey, onRunningChange }: {
  text: Translations['cpuLoad']; resetKey: number; onRunningChange: (running: boolean) => void;
}) {
  const [config, setConfig] = useState<Config | null>(null);
  const [rps, setRps] = useState(10);
  const [intensity, setIntensity] = useState('medium');
  const [duration, setDuration] = useState(180);
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState<Stats>(EMPTY);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/load/config', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Load config unavailable');
        const value: Config = await response.json();
        if (typeof value.enabled !== 'boolean' || !Number.isFinite(value.maxRps) ||
            !Number.isFinite(value.maxDurationSec)) throw new Error('Invalid load config');
        setConfig(value);
      }).catch(() => { if (!controller.signal.aborted) setConfig(null); });
    return () => controller.abort();
  }, []);

  useEffect(() => { setRunning(false); }, [resetKey]);

  useEffect(() => {
    if (!running || !config?.enabled) return;
    let cancelled = false;
    const started = performance.now();
    const counts = { ...EMPTY };
    const requests = new Map<AbortController, ReturnType<typeof setTimeout>>();
    const seconds = Math.min(duration, config.maxDurationSec, 300);
    const rate = Math.min(rps, config.maxRps, 20);
    if (rate <= 0 || seconds <= 0 || document.hidden) { setRunning(false); return; }
    onRunningChange(true);
    const publish = () => {
      counts.elapsed = Math.min(seconds, (performance.now() - started) / 1000);
      setStats({ ...counts });
    };
    const send = async () => {
      if (cancelled || performance.now() - started >= seconds * 1000) return;
      // No accumulated backlog or catch-up bursts on a slow connection.
      if (requests.size >= 8) { counts.skipped++; return; }
      const controller = new AbortController();
      requests.set(controller, setTimeout(() => controller.abort(), 4000));
      counts.sent++;
      try {
        const response = await fetch('/api/load/cpu', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intensity }), signal: controller.signal,
        });
        await response.text();
        if (cancelled) return;
        if (response.ok) counts.ok++;
        else if (response.status === 429) counts.limited++;
        else counts.failed++;
        if (response.status === 404) { setConfig({ ...config, enabled: false }); setRunning(false); }
      } catch {
        if (!cancelled) counts.failed++;
      } finally {
        clearTimeout(requests.get(controller));
        requests.delete(controller);
        if (!cancelled) publish();
      }
    };
    setStats({ ...EMPTY });
    void send();
    const sender = setInterval(() => { void send(); }, 1000 / rate);
    const ticker = setInterval(publish, 250);
    const deadline = setTimeout(() => setRunning(false), seconds * 1000);
    const stopWhenHidden = () => { if (document.hidden) setRunning(false); };
    document.addEventListener('visibilitychange', stopWhenHidden);
    return () => {
      cancelled = true;
      clearInterval(sender);
      clearInterval(ticker);
      clearTimeout(deadline);
      for (const [controller, timeout] of requests) { clearTimeout(timeout); controller.abort(); }
      document.removeEventListener('visibilitychange', stopWhenHidden);
      onRunningChange(false);
    };
  }, [running, config, rps, intensity, duration, onRunningChange]);

  const disabled = running || !config?.enabled;
  return (
    <div className="space-y-3 border-t border-line pt-5">
      <h4 className="text-base font-semibold">{text.title}</h4>
      <p className="text-xs text-muted">{text.description}</p>
      {!config?.enabled && <p className="rounded-xl bg-canvas px-3 py-2 text-xs text-warn">{text.disabled}</p>}
      <div className="grid grid-cols-3 gap-2 text-sm">
        <label className="space-y-1">RPS
          <select aria-label="CPU RPS" className="block w-full rounded-lg bg-canvas p-2" disabled={disabled} value={rps} onChange={(e) => setRps(Number(e.target.value))}>
            {[5, 10, 20].filter((value) => !config || value <= config.maxRps).map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className="space-y-1">{text.intensity}
          <select aria-label={text.intensity} className="block w-full rounded-lg bg-canvas p-2" disabled={disabled} value={intensity} onChange={(e) => setIntensity(e.target.value)}>
            <option value="light">{text.light}</option><option value="medium">{text.medium}</option><option value="heavy">{text.heavy}</option>
          </select>
        </label>
        <label className="space-y-1">{text.duration}
          <select aria-label={text.duration} className="block w-full rounded-lg bg-canvas p-2" disabled={disabled} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {[60, 180, 300].filter((value) => !config || value <= config.maxDurationSec).map((value) => <option key={value} value={value}>{value / 60} min</option>)}
          </select>
        </label>
      </div>
      <button className="w-full rounded-xl bg-cobalt py-2 text-sm font-semibold text-white disabled:opacity-40 cursor-pointer" disabled={!running && !config?.enabled} onClick={() => setRunning(!running)}>
        {running ? text.stop : text.start}
      </button>
      <div className="rounded-xl bg-canvas p-3 text-xs space-y-1" role="status">
        <p>{text.remaining}: {running ? Math.max(0, Math.ceil(duration - stats.elapsed)) : 0}s · {text.actualRps}: {stats.elapsed > 0 ? (stats.sent / stats.elapsed).toFixed(1) : '0.0'}</p>
        <p>{text.success}: {stats.ok} · {text.failed}: {stats.failed} · 429: {stats.limited} · {text.skipped}: {stats.skipped}</p>
      </div>
    </div>
  );
}
