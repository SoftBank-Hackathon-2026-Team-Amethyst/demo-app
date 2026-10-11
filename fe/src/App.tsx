import React, { useState, useEffect, useRef, useMemo } from 'react';
import { translations, Language, LANGUAGE_OPTIONS } from './i18n';
import RuntimePods from './RuntimePods';
import { CpuLoadPanel } from './CpuLoadPanel';

interface ServerInfo {
  version: string;
  themeColor: string;
  themeName: string;
  env: string;
  uptime: number;
  hostname: string;
  region: string;
  dbConnected: boolean;
  timestamp: string;
}

interface PodMetrics {
  hostname: string;
  rps: number;
  rpsSeries: number[];
  totalRequests: number;
  p50: number;
  p95: number;
  cpuPercent: number;
  memoryMb: number;
  load1: number;
  endSec: number;
}

interface ChaosState {
  latencyMs: number;
  errorRate: number;
  dbError: boolean;
  enabled?: boolean; // BE의 CHAOS_ENABLED. false면 변경 API가 닫혀 있다
}

interface VoteItem {
  id: number;
  optionKey: string;
  title: string;
  count: number;
  percentage: number;
}

interface GuestbookEntry {
  id: number;
  name: string;
  message: string;
  createdAt: string;
}

// 응답 기록의 한 칸: 1초 폴링 1회
interface Beat {
  seq: number;
  ok: boolean;
  ms: number;
  host: string;
  version: string;
}

const HISTORY = 60;
const TRAFFIC_POINTS = 30; // 트래픽 차트 가로 축 초 단위 개수
const TRAFFIC_SAMPLE_TTL_MS = 6000; // Legacy traffic aggregation only; never used for Pod inventory.

// 투표 상태는 브라우저 localStorage에만 저장 (로그인 없는 데모 특성상 UX 수준의 중복 방지)
const VOTED_KEY = 'demo_voted_option';
const LANG_KEY = 'demo_lang';

function loadVotedOption(): number | null {
  const raw = localStorage.getItem(VOTED_KEY);
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return isNaN(parsed) ? null : parsed;
}

function loadInitialLanguage(): Language {
  const saved = localStorage.getItem(LANG_KEY);
  if (saved === 'en' || saved === 'ja' || saved === 'ko') {
    return saved;
  }
  return 'en'; // 기본 언어: 영어
}

// 파드 이름 -> 고정된 색 (같은 파드는 항상 같은 색)
const PALETTE = ['#2b4bff', '#0ea5a4', '#a855f7', '#f97316', '#0f172a', '#ec4899'];
function hostColor(host: string): string {
  let h = 0;
  for (let i = 0; i < host.length; i++) h = (h * 31 + host.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** 값이 바뀔 때만 아래에서 올라오는 숫자/문자 */
function Roll({ value }: { value: string | number }) {
  return <span key={String(value)} className="roll">{value}</span>;
}

function Tile({
  title, className = '', delay = 0, right, children,
}: {
  title?: string; className?: string; delay?: number; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section
      className={`rise rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(17,24,39,.04),0_8px_24px_-12px_rgba(17,24,39,.12)] ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-muted">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

function Pill({ tone, children }: { tone: 'ok' | 'warn' | 'bad' | 'blue' | 'lime'; children: React.ReactNode }) {
  const map = {
    ok: 'bg-green-100 text-green-800',
    warn: 'bg-amber-100 text-amber-800',
    bad: 'bg-red-100 text-red-800',
    blue: 'bg-cobalt text-white',
    lime: 'bg-lime text-ink',
  };
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${map[tone]}`}>{children}</span>;
}

/** 초당 요청 수 영역 차트. 1초마다 한 칸씩 왼쪽으로 밀리고, Y축은 5단위로만 바뀌어 흔들리지 않는다 */
function AreaChart({ data, slideKey, color = '#2b4bff', ariaLabel }: { data: number[]; slideKey: number; color?: string; ariaLabel: string }) {
  const W = 600, H = 160, pad = 8;
  const peak = Math.max(0, ...data);
  const max = Math.max(5, Math.ceil(peak / 5) * 5);
  const pts = data.length >= 2 ? data : [0, 0];
  const step = W / (pts.length - 2);
  const xy = pts.map((v, i) => [(i - 1) * step, H - pad - (v / max) * (H - pad * 2)] as const);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${xy[xy.length - 1][0]} ${H} L${xy[0][0]} ${H} Z`;
  const last = xy[xy.length - 1];
  return (
    <div className="relative">
      <span className="absolute left-0 top-0 text-sm text-muted">{max}/s</span>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40" preserveAspectRatio="none" role="img" aria-label={ariaLabel}>
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity=".25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((r) => (
          <line key={r} x1="0" x2={W} y1={H * r} y2={H * r} stroke="#e5e7eb" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        <g key={slideKey} className="slide-left" style={{ ['--step' as string]: `${step}px` }}>
          <path d={area} fill="url(#areaFill)" />
          <path d={line} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <circle cx={last[0]} cy={last[1]} r="5" fill={color} stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </g>
      </svg>
    </div>
  );
}

export default function App() {
  const [lang, setLang] = useState<Language>(loadInitialLanguage);
  const t = translations[lang];

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem(LANG_KEY, newLang);
  };

  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [online, setOnline] = useState(true);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [switchEvent, setSwitchEvent] = useState<{ id: number; from: string; to: string; version: string } | null>(null);
  const [latestMetrics, setLatestMetrics] = useState<PodMetrics | null>(null);
  const [traffic, setTraffic] = useState<{ series: number[]; endSec: number }>({ series: [], endSec: 0 });
  const seqRef = useRef(0);
  const lastSig = useRef<string | null>(null);

  // 시연용 관리자 패널(Admin Drawer) 및 부하/장애 상태
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [chaos, setChaos] = useState<ChaosState>({ latencyMs: 0, errorRate: 0, dbError: false });
  const [chaosLoading, setChaosLoading] = useState(false);
  const [loadRps, setLoadRps] = useState<number>(0); // 0, 10, 30, 60
  const [cpuLoadRunning, setCpuLoadRunning] = useState(false);
  const [loadResetKey, setLoadResetKey] = useState(0);

  const [votes, setVotes] = useState<VoteItem[]>([]);
  const [totalVotes, setTotalVotes] = useState<number>(0);
  const [myVotedOptionId, setMyVotedOptionId] = useState<number | null>(loadVotedOption);
  const [guestbook, setGuestbook] = useState<GuestbookEntry[]>([]);
  const [votingLoading, setVotingLoading] = useState<number | null>(null);

  const [author, setAuthor] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  // 1. 실시간 1초 폴링 (/api/info)
  useEffect(() => {
    let cancelled = false;
    let inflight = false;
    const poll = async () => {
      if (inflight) return;
      inflight = true;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3500);
      const t0 = performance.now();
      let beat: Beat;
      try {
        const res = await fetch('/api/info', { cache: 'no-store', signal: ctrl.signal });
        const ms = Math.round(performance.now() - t0);
        if (!res.ok) throw new Error(String(res.status));
        const data: ServerInfo = await res.json();
        if (cancelled) return;
        setInfo(data);
        setOnline(true);
        beat = { seq: ++seqRef.current, ok: true, ms, host: data.hostname, version: data.version };

        const sig = `${data.version}|${data.hostname}`;
        if (lastSig.current && lastSig.current !== sig) {
          setSwitchEvent({ id: beat.seq, from: lastSig.current.split('|')[1], to: data.hostname, version: data.version });
        }
        lastSig.current = sig;
      } catch {
        if (cancelled) return;
        setOnline(false);
        beat = { seq: ++seqRef.current, ok: false, ms: 0, host: '', version: '' };
      } finally {
        clearTimeout(timer);
        inflight = false;
      }
      setBeats((prev) => [...prev, beat].slice(-HISTORY));
    };
    poll();
    const id = setInterval(poll, 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // 2. 실시간 1초 메트릭 폴링 (/api/metrics)
  useEffect(() => {
    let cancelled = false;
    const podSeries: Record<string, { counts: Map<number, number>; last: number; seen: number }> = {};
    const poll = async () => {
      try {
        const res = await fetch('/api/metrics', { cache: 'no-store' });
        if (!res.ok) return;
        const m: PodMetrics = await res.json();
        if (cancelled) return;
        const t = Date.now();

        const entry = podSeries[m.hostname] ?? { counts: new Map<number, number>(), last: 0, seen: 0 };
        m.rpsSeries.forEach((v, i) => entry.counts.set(m.endSec - (m.rpsSeries.length - 1) + i, v));
        entry.last = Math.max(entry.last, m.endSec);
        entry.seen = t;
        for (const k of entry.counts.keys()) if (k < m.endSec - 90) entry.counts.delete(k);
        podSeries[m.hostname] = entry;

        const live = Object.entries(podSeries).filter(([, v]) => t - v.seen < TRAFFIC_SAMPLE_TTL_MS);
        for (const [k, v] of Object.entries(podSeries)) if (t - v.seen >= TRAFFIC_SAMPLE_TTL_MS) delete podSeries[k];

        // 모든 살아있는 파드의 데이터가 존재하는 마지막 초까지만 그린다
        const endSec = Math.min(...live.map(([, v]) => v.last));
        const series: number[] = [];
        for (let s = endSec - (TRAFFIC_POINTS - 1); s <= endSec; s++) {
          series.push(live.reduce((sum, [, v]) => sum + (v.counts.get(s) ?? 0), 0));
        }
        setTraffic({ series, endSec });

        setLatestMetrics(m);
      } catch { /* 무시 */ }
    };
    poll();
    const id = setInterval(poll, 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // 3. 장애 상태 조회 (/api/chaos)
  const fetchChaos = async () => {
    try {
      const res = await fetch('/api/chaos');
      if (res.ok) {
        const data: ChaosState = await res.json();
        setChaos(data);
      }
    } catch { /* 무시 */ }
  };

  useEffect(() => {
    fetchChaos();
  }, []);

  const updateChaos = async (patch: Partial<ChaosState>) => {
    setChaosLoading(true);
    try {
      const res = await fetch('/api/chaos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const data: ChaosState = await res.json();
        setChaos(data);
      }
    } catch (err) {
      console.error('Failed to update chaos state:', err);
    } finally {
      setChaosLoading(false);
    }
  };

  const resetChaos = async () => {
    setChaosLoading(true);
    try {
      const res = await fetch('/api/chaos/reset', { method: 'POST' });
      if (res.ok) {
        const data: ChaosState = await res.json();
        setChaos(data);
      }
    } catch (err) {
      console.error('Failed to reset chaos:', err);
    } finally {
      setChaosLoading(false);
    }
  };

  // 4. 클라이언트 사이드 트래픽 부하 생성기 (Load Generator)
  useEffect(() => {
    if (loadRps <= 0) return;

    const intervalMs = Math.max(15, Math.floor(1000 / loadRps));
    const timer = setInterval(() => {
      fetch('/api/votes', { cache: 'no-store' }).catch(() => {});
    }, intervalMs);

    return () => clearInterval(timer);
  }, [loadRps]);

  useEffect(() => {
    if (!switchEvent) return;
    const tTimer = setTimeout(() => setSwitchEvent(null), 5000);
    return () => clearTimeout(tTimer);
  }, [switchEvent]);

  const fetchVotes = async () => {
    try {
      const res = await fetch('/api/votes');
      if (res.ok) {
        const data = await res.json();
        setVotes(data.items);
        setTotalVotes(data.totalVotes);
      }
    } catch (err) {
      console.error('Failed to fetch /api/votes:', err);
    }
  };

  const fetchGuestbook = async () => {
    try {
      const res = await fetch('/api/guestbook');
      if (res.ok) {
        const data = await res.json();
        setGuestbook(data.entries);
      }
    } catch (err) {
      console.error('Failed to fetch /api/guestbook:', err);
    }
  };

  useEffect(() => {
    fetchVotes();
    fetchGuestbook();
    const dataInterval = setInterval(() => {
      fetchVotes();
      fetchGuestbook();
    }, 3000);
    return () => clearInterval(dataInterval);
  }, []);

  const handleVote = async (id: number) => {
    if (myVotedOptionId !== null) return;
    setVotingLoading(id);
    try {
      const res = await fetch(`/api/votes/${id}`, { method: 'POST' });
      if (res.ok) {
        localStorage.setItem(VOTED_KEY, String(id));
        setMyVotedOptionId(id);
        await fetchVotes();
      }
    } catch (err) {
      console.error('Vote failed:', err);
    } finally {
      setVotingLoading(null);
    }
  };

  const handleGuestbookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!author.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: author, message }),
      });
      if (res.ok) {
        setMessage('');
        await fetchGuestbook();
      }
    } catch (err) {
      console.error('Guestbook submit failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const okBeats = beats.filter((b) => b.ok);
  const sortedMs = okBeats.map((b) => b.ms).sort((a, b) => a - b);
  const avgMs = sortedMs.length ? sortedMs[Math.floor(sortedMs.length / 2)] : 0;
  const p95Ms = sortedMs.length ? sortedMs[Math.min(sortedMs.length - 1, Math.floor(sortedMs.length * 0.95))] : 0;
  const failCount = beats.length - okBeats.length;
  const availability = beats.length ? ((okBeats.length / beats.length) * 100).toFixed(1) : '—';
  const maxMs = Math.max(100, ...okBeats.map((b) => b.ms));
  const rolloutBreakdown = useMemo(() => {
    if (okBeats.length === 0) return [];
    const counts: Record<string, number> = {};
    okBeats.forEach((b) => {
      const ver = b.version || 'v1.0.0';
      counts[ver] = (counts[ver] || 0) + 1;
    });
    const total = okBeats.length;
    return Object.entries(counts)
      .map(([version, count]) => ({
        version,
        count,
        percent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.percent - a.percent);
  }, [okBeats]);

  const status = !online ? 'down' : info?.dbConnected === false ? 'degraded' : 'ok';
  const headline = t.status[status].headline;
  const statusTone = ({ ok: 'ok', degraded: 'warn', down: 'bad' } as const)[status];
  const statusLabel = t.status[status].label;

  const dateLocale = lang === 'ko' ? 'ko-KR' : lang === 'ja' ? 'ja-JP' : 'en-US';

  const services = [
    { name: t.services.frontend, ok: true, detail: 'nginx' },
    { name: t.services.backendApi, ok: online, detail: online ? `${avgMs}ms` : t.serviceDetails.noResponse },
    {
      name: t.services.database,
      ok: online && !!info?.dbConnected,
      detail: info?.dbConnected ? 'PostgreSQL' : online ? t.serviceDetails.memoryMode : t.serviceDetails.unavailable,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      {/* 상단 바 */}
      <header className="rise flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-cobalt">
            <span className="h-4 w-4 rounded-full bg-lime" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">{t.title}</h1>
            <p className="text-sm text-muted">{info?.env ?? 'production'} · {info?.region ?? '—'}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {switchEvent && (
            <span key={switchEvent.id} className="pop">
              <Pill tone="lime">{t.newVersionSwitched(switchEvent.version)}</Pill>
            </span>
          )}

          {/* 언어 전환 버튼 그룹 */}
          <div className="flex items-center rounded-2xl bg-canvas p-1 shadow-xs border border-line/60">
            <svg
              className="w-4 h-4 text-muted ml-1.5 mr-1 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" strokeWidth="2" />
              <path strokeWidth="2" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
            </svg>
            <div className="flex items-center gap-0.5">
              {LANGUAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => handleLanguageChange(opt.key)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-xl transition cursor-pointer ${
                    lang === opt.key
                      ? 'bg-cobalt text-white shadow-xs'
                      : 'text-muted hover:text-ink'
                  }`}
                  title={opt.label}
                >
                  {opt.short}
                </button>
              ))}
            </div>
          </div>

          {/* 시연 도구 (관리자 패널) 토글 버튼 */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-1.5 rounded-2xl bg-ink px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-ink/90 active:scale-95 transition cursor-pointer"
          >
            <span>🛠</span>
            <span>{t.demoTools}</span>
            {(loadRps > 0 || cpuLoadRunning || chaos.latencyMs > 0 || chaos.errorRate > 0 || chaos.dbError) && (
              <span className="h-2 w-2 rounded-full bg-lime animate-pulse" />
            )}
          </button>

          <span className="text-base font-semibold tabular-nums text-muted">{now.toLocaleTimeString(dateLocale, { hour12: false })}</span>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-4">
        {/* 히어로 */}
        <Tile className="col-span-12 lg:col-span-8 flex flex-col justify-between min-h-[280px]" delay={60}>
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              {status === 'ok' && <span className="ping absolute inline-flex h-full w-full rounded-full bg-ok opacity-60" />}
              <span className={`relative inline-flex h-3 w-3 rounded-full ${status === 'ok' ? 'bg-ok' : status === 'degraded' ? 'bg-warn' : 'bg-bad'}`} />
            </span>
            <Pill tone={statusTone}>{statusLabel}</Pill>
            <span className="text-lg font-medium text-muted"><Roll value={headline} /></span>
          </div>

          <div className="flex flex-wrap items-end gap-x-10 gap-y-4 mt-6">
            <div>
              <div className="text-base text-muted mb-1">{t.currentVersion}</div>
              <div className="text-7xl sm:text-8xl font-extrabold tracking-tight leading-none text-cobalt">
                <Roll value={info?.version ?? '—'} />
              </div>
            </div>
            <div className="pb-1">
              <div className="text-base text-muted mb-1">{t.uptime}</div>
              <div className="text-3xl font-bold"><Roll value={info ? t.formatUptime(info.uptime) : '—'} /></div>
            </div>
            <div className="pb-1 min-w-0">
              <div className="text-base text-muted mb-1">{t.respondingPod}</div>
              <div className="flex items-center gap-2 text-xl font-semibold">
                <span className="h-3.5 w-3.5 rounded-full shrink-0" style={{ background: info ? hostColor(info.hostname) : '#9ca3af' }} />
                <span className="truncate max-w-[16rem]" title={info?.hostname}><Roll value={info?.hostname ?? '—'} /></span>
              </div>
            </div>
          </div>
        </Tile>

        {/* 서비스 상태 */}
        <Tile title={t.serviceStatusTitle} className="col-span-12 lg:col-span-4" delay={120}>
          <ul className="space-y-3">
            {services.map((s) => (
              <li key={s.name} className="flex items-center justify-between rounded-2xl bg-canvas px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`h-3 w-3 rounded-full ${s.ok ? 'bg-ok' : 'bg-bad'}`} />
                  <span className="text-base font-semibold">{s.name}</span>
                </div>
                <span className="text-sm text-muted">{s.detail}</span>
              </li>
            ))}
          </ul>
        </Tile>

        {/* 배포 롤아웃 & 트래픽 분배 애니메이션 타일 */}
        <Tile
          title={t.rolloutTitle}
          className="col-span-12 bg-white"
          delay={150}
          right={
            <div className="flex items-center gap-2 text-sm text-muted">
              {rolloutBreakdown.length > 1 ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-cobalt bg-cobalt/10 px-2.5 py-1 rounded-full">
                  <span className="h-2 w-2 rounded-full bg-cobalt animate-ping" />
                  {t.rolloutInProgress(rolloutBreakdown.length)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-green-700 bg-green-100 px-2.5 py-1 rounded-full font-medium">
                  {t.singleVersionStable}
                </span>
              )}
            </div>
          }
        >
          <div className="space-y-3">
            {/* 실시간 롤아웃 분배율 바 */}
            <div className="h-5 w-full rounded-full bg-line overflow-hidden flex shadow-inner">
              {rolloutBreakdown.map((item, idx) => {
                const colors = ['bg-cobalt', 'bg-lime', 'bg-purple-600', 'bg-orange-500'];
                const bg = colors[idx % colors.length];
                return (
                  <div
                    key={item.version}
                    className={`h-full ${bg} transition-all duration-700 ease-out flex items-center justify-center text-[11px] font-bold ${idx === 1 ? 'text-ink' : 'text-white'}`}
                    style={{ width: `${item.percent}%` }}
                    title={`${item.version}: ${item.percent}% (${item.count})`}
                  >
                    {item.percent >= 15 ? `${item.version} (${item.percent}%)` : ''}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-1 text-sm">
              <div className="flex flex-wrap items-center gap-4">
                {rolloutBreakdown.map((item, idx) => {
                  const dotColors = ['bg-cobalt', 'bg-lime', 'bg-purple-600', 'bg-orange-500'];
                  return (
                    <div key={item.version} className="flex items-center gap-2">
                      <span className={`h-3 w-3 rounded-full ${dotColors[idx % dotColors.length]}`} />
                      <span className="font-semibold">{item.version}</span>
                      <span className="font-mono text-muted">{t.trafficServing(item.percent)}</span>
                    </div>
                  );
                })}
              </div>
              <span className="text-xs text-muted">{t.sampleBasis}</span>
            </div>
          </div>
        </Tile>

        {/* KPI 3개 */}
        <Tile title={t.availabilityTitle} className="col-span-12 sm:col-span-4" delay={180}>
          <div className="text-6xl font-extrabold tracking-tight leading-none">
            <Roll value={availability === '—' ? '—' : `${availability}`} />
            <span className="text-3xl font-bold text-muted">%</span>
          </div>
          <p className="mt-3 text-base text-muted">
            {failCount === 0 ? t.availabilityOk : t.availabilityFail(failCount)}
          </p>
        </Tile>

        <Tile title={t.responseTimeTitle} className="col-span-12 sm:col-span-4" delay={220}>
          <div className="text-6xl font-extrabold tracking-tight leading-none">
            <Roll value={avgMs} />
            <span className="text-3xl font-bold text-muted">ms</span>
          </div>
          <p className="mt-3 text-base text-muted">
            {sortedMs.length ? t.responseTimeP95(p95Ms) : t.responseTimeClient}
          </p>
        </Tile>

        <Tile title={t.rpsTitle} className="col-span-12 sm:col-span-4 bg-lime!" delay={260}>
          <div className="text-6xl font-extrabold tracking-tight leading-none">
            <Roll value={latestMetrics ? latestMetrics.rps.toFixed(1) : '—'} />
            <span className="text-3xl font-bold text-ink/60"> /s</span>
          </div>
          <p className="mt-3 text-base text-ink/70">
            {latestMetrics ? t.rpsTotal(latestMetrics.totalRequests) : t.waitingMetrics}
          </p>
        </Tile>

        {/* 트래픽 차트 */}
        <Tile
          title={t.trafficChartTitle}
          className="col-span-12 lg:col-span-7"
          delay={300}
          right={latestMetrics && <span className="text-sm text-muted">{latestMetrics.hostname}</span>}
        >
          <AreaChart data={traffic.series} slideKey={traffic.endSec} ariaLabel={t.trafficChartAria} />
          <div className="mt-2 flex justify-between text-sm text-muted">
            <span>{t.thirtySecAgo}</span>
            <span>{t.now}</span>
          </div>
        </Tile>

        {/* 파드별 리소스 */}
        <Tile title={t.runtime.title} className="col-span-12 lg:col-span-5" delay={340}>
          <RuntimePods lang={lang} now={now.getTime()} colorForHost={hostColor} />
        </Tile>

        {/* 응답 기록 */}
        <Tile
          title={t.historyTitle}
          className="col-span-12"
          delay={380}
          right={<span className="text-sm text-muted">{t.historyHint}</span>}
        >
          <div className="flex items-end gap-[3px] h-28">
            {Array.from({ length: HISTORY - beats.length }).map((_, i) => (
              <div key={`e${i}`} className="flex-1 h-1 rounded-full bg-line" />
            ))}
            {beats.map((b) =>
              b.ok ? (
                <div
                  key={b.seq}
                  className="bar-in flex-1 rounded-md"
                  title={`${b.version} · ${b.host} · ${b.ms}ms`}
                  style={{ height: `${Math.max(8, (b.ms / maxMs) * 100)}%`, background: hostColor(b.host) }}
                />
              ) : (
                <div key={b.seq} className="bar-in flex-1 h-full rounded-md bg-red-100 border-2 border-dashed border-bad" title={t.noResponseTooltip} />
              )
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted">
            {[...new Set(okBeats.map((b) => b.host))].map((h) => (
              <span key={h} className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm" style={{ background: hostColor(h) }} />{h}
              </span>
            ))}
            {failCount > 0 && (
              <span className="inline-flex items-center gap-2 text-bad font-medium">
                <span className="h-3 w-3 rounded-sm border-2 border-dashed border-bad" />{t.failCountHistory(failCount)}
              </span>
            )}
          </div>
        </Tile>

        {/* 투표 */}
        <Tile
          title={t.voteTitle}
          className="col-span-12 lg:col-span-6"
          delay={420}
          right={<span className="text-sm text-muted">{t.voteTotal(totalVotes)}</span>}
        >
          <ul className="space-y-3">
            {votes.map((item) => {
              const mine = myVotedOptionId === item.id;
              const hasVoted = myVotedOptionId !== null;
              const optionDisplayTitle = (item.optionKey && t.voteOptions[item.optionKey]) || item.title;

              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleVote(item.id)}
                    disabled={hasVoted || votingLoading === item.id}
                    className={`group relative w-full overflow-hidden rounded-2xl px-4 py-3.5 text-left bg-canvas transition-shadow ${
                      hasVoted ? 'cursor-default' : 'cursor-pointer hover:shadow-[inset_0_0_0_2px_#2b4bff]'
                    } ${mine ? 'shadow-[inset_0_0_0_2px_#2b4bff]' : ''}`}
                  >
                    <span
                      className={`absolute inset-y-0 left-0 transition-[width] duration-700 ease-out ${mine ? 'bg-cobalt/20' : 'bg-cobalt/10'}`}
                      style={{ width: `${item.percentage}%` }}
                    />
                    <span className="relative flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-base font-semibold">
                        {optionDisplayTitle}
                        {mine && <Pill tone="blue">{t.myChoice}</Pill>}
                      </span>
                      <span className="text-base font-bold whitespace-nowrap">
                        {votingLoading === item.id ? t.voting : <><Roll value={item.percentage} />%</>}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-sm text-muted">
            {myVotedOptionId !== null ? t.alreadyVotedNotice : t.canVoteOnce}
          </p>
        </Tile>

        {/* 방명록 */}
        <Tile title={t.guestbookTitle} className="col-span-12 lg:col-span-6" delay={460}>
          <form onSubmit={handleGuestbookSubmit} className="space-y-3 mb-4">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder={t.namePlaceholder}
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                maxLength={50}
                required
                className="w-1/3 rounded-2xl bg-canvas px-4 py-3 text-base placeholder:text-muted/70 outline-none focus:ring-2 focus:ring-cobalt"
              />
              <input
                type="text"
                placeholder={t.messagePlaceholder}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={200}
                required
                className="flex-1 min-w-0 rounded-2xl bg-canvas px-4 py-3 text-base placeholder:text-muted/70 outline-none focus:ring-2 focus:ring-cobalt"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl bg-cobalt px-4 py-3 text-base font-semibold text-white transition hover:brightness-110 active:scale-[.99] disabled:opacity-50 cursor-pointer"
            >
              {submitting ? t.submitting : t.submit}
            </button>
          </form>

          <div className="max-h-56 overflow-y-auto -mx-1 px-1 space-y-2">
            {guestbook.length === 0 ? (
              <p className="py-6 text-center text-base text-muted">{t.emptyGuestbook}</p>
            ) : (
              guestbook.map((entry) => (
                <div key={entry.id} className="rise rounded-2xl bg-canvas px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-base font-semibold">{entry.name}</span>
                    <span className="text-sm text-muted">
                      {new Date(entry.createdAt).toLocaleTimeString(dateLocale, { hour12: false })}
                    </span>
                  </div>
                  <p className="mt-0.5 text-base break-words">{entry.message}</p>
                </div>
              ))
            )}
          </div>
        </Tile>
      </div>

      <footer className="mt-8 text-center text-sm text-muted">
        SoftBank Hackathon 2026 · Team Amethyst
      </footer>

      {/* 시연 도구 관리자 드로어 (Admin Controls Drawer) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-ink/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          />

          {/* Drawer Body */}
          <div className="slide-drawer relative z-10 w-full max-w-md bg-white h-full shadow-2xl p-6 overflow-y-auto flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-line pb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🛠</span>
                  <h3 className="text-xl font-bold">{t.adminTitle}</h3>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="rounded-xl p-2 text-muted hover:bg-canvas text-lg leading-none cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* 1. 트래픽 부하 생성기 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-semibold">{t.trafficGenTitle}</h4>
                  <span className="font-mono text-sm font-bold text-cobalt">{loadRps > 0 ? t.trafficRunning(loadRps) : t.stopped}</span>
                </div>
                <p className="text-xs text-muted">{t.trafficGenDesc}</p>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 10, 30, 60].map((rps) => (
                    <button
                      key={rps}
                      onClick={() => setLoadRps(rps)}
                      className={`py-2 px-3 rounded-xl text-sm font-semibold transition cursor-pointer ${
                        loadRps === rps
                          ? 'bg-cobalt text-white shadow-sm'
                          : 'bg-canvas text-ink hover:bg-line'
                      }`}
                    >
                      {rps === 0 ? t.stopButton : `${rps} RPS`}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. CPU 부하 테스트 */}
              <CpuLoadPanel text={t.cpuLoad} resetKey={loadResetKey} onRunningChange={setCpuLoadRunning} />

              {/* 3. 장애 주입 (Chaos Simulation) */}
              <div className="space-y-4 border-t border-line pt-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-semibold">{t.chaosTitle}</h4>
                  {chaosLoading && <span className="text-xs text-muted animate-pulse">{t.applying}</span>}
                </div>
                <p className="text-xs text-muted">{t.chaosDesc}</p>
                {chaos.enabled === false && (
                  <p className="rounded-xl bg-canvas px-3 py-2 text-xs text-warn">
                    {t.chaosDisabledNotice}
                  </p>
                )}

                {/* 지연 주입 */}
                <div className="rounded-2xl bg-canvas p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{t.latencySpike}</span>
                    <span className="font-mono font-bold text-cobalt">+{chaos.latencyMs}ms</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[0, 1000, 2500].map((ms) => (
                      <button
                        key={ms}
                        onClick={() => updateChaos({ latencyMs: ms })}
                        disabled={chaos.enabled === false}
                        className={`py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                          chaos.latencyMs === ms
                            ? 'bg-ink text-white'
                            : 'bg-white text-muted border border-line hover:bg-canvas'
                        }`}
                      >
                        {ms === 0 ? t.noLatency : `+${ms}ms`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 500 에러율 주입 */}
                <div className="rounded-2xl bg-canvas p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold">{t.errorRateTitle}</span>
                    <span className="font-mono font-bold text-bad">{Math.round(chaos.errorRate * 100)}%</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[0, 0.5, 1.0].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => updateChaos({ errorRate: rate })}
                        disabled={chaos.enabled === false}
                        className={`py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                          chaos.errorRate === rate
                            ? 'bg-bad text-white'
                            : 'bg-white text-muted border border-line hover:bg-canvas'
                        }`}
                      >
                        {rate === 0 ? t.normal : t.errorRateLabel(Math.round(rate * 100))}
                      </button>
                    ))}
                  </div>
                </div>

                {/* DB 연결 단절 */}
                <div className="rounded-2xl bg-canvas p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">{t.dbFailureTitle}</div>
                    <div className="text-xs text-muted">{t.memoryFallbackDesc}</div>
                  </div>
                  <button
                    onClick={() => updateChaos({ dbError: !chaos.dbError })}
                    disabled={chaos.enabled === false}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition ${
                      chaos.dbError
                        ? 'bg-warn text-white'
                        : 'bg-white text-muted border border-line hover:bg-canvas'
                    }`}
                  >
                    {chaos.dbError ? t.dbDisconnected : t.dbConnected}
                  </button>
                </div>
              </div>
            </div>

            {/* 하단 원클릭 정상화 버튼 */}
            <div className="border-t border-line pt-4 mt-6 space-y-2">
              <button
                onClick={() => {
                  setLoadRps(0);
                  setLoadResetKey((key) => key + 1);
                  if (chaos.enabled) resetChaos();
                }}
                disabled={chaosLoading}
                className="w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-bold text-white shadow hover:bg-green-700 active:scale-98 transition cursor-pointer"
              >
                {t.resetAll}
              </button>
              <p className="text-center text-[11px] text-muted">{t.resetDesc}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
