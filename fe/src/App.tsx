import React, { useState, useEffect } from 'react';
import { 
  Rocket, 
  Activity, 
  Database, 
  Server, 
  Clock, 
  CheckCircle2, 
  Vote as VoteIcon, 
  MessageSquare, 
  Send, 
  Check
} from 'lucide-react';

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

// 투표 상태는 브라우저 localStorage에만 저장 (로그인 없는 데모 특성상 UX 수준의 중복 방지)
const VOTED_KEY = 'demo_voted_option';

function loadVotedOption(): number | null {
  const raw = localStorage.getItem(VOTED_KEY);
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return isNaN(parsed) ? null : parsed;
}

export default function App() {
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [votes, setVotes] = useState<VoteItem[]>([]);
  const [totalVotes, setTotalVotes] = useState<number>(0);
  const [myVotedOptionId, setMyVotedOptionId] = useState<number | null>(loadVotedOption);
  const [guestbook, setGuestbook] = useState<GuestbookEntry[]>([]);
  const [votingLoading, setVotingLoading] = useState<number | null>(null);

  // Guestbook Form State
  const [author, setAuthor] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState<Date>(new Date());

  // 현재 시각 표시용 1초 시계
  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  // 1. Fetch Server Info (1-second polling for zero-downtime visualization)
  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await fetch('/api/info');
        if (res.ok) {
          const data: ServerInfo = await res.json();
          setInfo(data);
        }
      } catch (err) {
        console.error('Failed to fetch /api/info:', err);
      }
    };

    fetchInfo();
    const interval = setInterval(fetchInfo, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Fetch Votes
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

  // 3. Fetch Guestbook
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

  // Handle Vote (localStorage 기반 1인 1투표)
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

  // Handle Guestbook Submit
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

  const isV2 = info?.version?.startsWith('v2');
  const accentBorder = isV2 ? 'border-emerald-500/40' : 'border-blue-500/40';
  const accentBadge = isV2 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-blue-500/20 text-blue-300 border-blue-500/30';
  const progressBg = isV2 ? 'bg-emerald-500' : 'bg-blue-500';
  const buttonBg = isV2 ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-blue-600 hover:bg-blue-500';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-4xl space-y-6">

        {/* 1. TOP HEADER & DEPLOYMENT STATUS CARD */}
        <header className={`bg-slate-900/90 border ${accentBorder} rounded-2xl p-6 shadow-2xl backdrop-blur-md transition-all duration-700`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className={`p-3 rounded-xl ${isV2 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'} transition-colors duration-700`}>
                <Rocket className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                  Release Pulse
                  <span className={`text-xs px-2.5 py-0.5 rounded-full border font-mono font-medium ${accentBadge} transition-all duration-700`}>
                    {info?.version || 'v1.0.0'}
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  원터치 배포 자동화 서비스 시연용 타겟 애플리케이션
                </p>
              </div>
            </div>

            {/* Current Time */}
            <div className="flex items-center gap-2 text-sm font-mono text-slate-300 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800/80 self-start md:self-auto">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>{now.toLocaleTimeString()}</span>
            </div>
          </div>

          {/* Runtime Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5">
            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>헬스체크 (Health)</span>
              </div>
              <div className="text-sm font-semibold flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Healthy (200 OK)</span>
              </div>
            </div>

            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span>DB 연결 상태</span>
              </div>
              <div className="text-sm font-semibold">
                {info?.dbConnected ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    PostgreSQL 연결됨
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    메모리 Fallback 모드
                  </span>
                )}
              </div>
            </div>

            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Server className="w-3.5 h-3.5 text-indigo-400" />
                <span>호스트 / 파드 ID</span>
              </div>
              <div className="text-sm font-mono truncate text-slate-200" title={info?.hostname}>
                {info?.hostname || 'localhost'}
              </div>
            </div>

            <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>가동 시간 (Uptime)</span>
              </div>
              <div className="text-sm font-mono text-slate-200">
                {info?.uptime ? `${info.uptime}s` : '0s'}
              </div>
            </div>
          </div>
        </header>

        {/* 2. REAL-TIME VOTING SECTION (1 Vote per Person) */}
        <section className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
            <div className="flex items-center space-x-2.5">
              <VoteIcon className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-semibold">실시간 투표: "가장 선호하는 배포 전략은?"</h2>
            </div>
            <div className="flex items-center gap-2">
              {myVotedOptionId !== null && (
                <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  투표 참여 완료 (1인 1투표)
                </span>
              )}
              <span className="text-xs text-slate-400 font-mono">
                총 {totalVotes}표
              </span>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {votes.map((item) => {
              const isMyChoice = myVotedOptionId === item.id;
              const hasVoted = myVotedOptionId !== null;

              return (
                <div 
                  key={item.id} 
                  className={`bg-slate-950/50 p-4 rounded-xl border transition-all ${
                    isMyChoice 
                      ? 'border-indigo-500/60 ring-1 ring-indigo-500/30' 
                      : 'border-slate-800/60'
                  } space-y-2`}
                >
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-200">{item.title}</span>
                      {isMyChoice && (
                        <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                          <Check className="w-3 h-3" /> 내 선택
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className="text-xs font-mono text-slate-400">{item.count}표 ({item.percentage}%)</span>
                      <button
                        onClick={() => handleVote(item.id)}
                        disabled={hasVoted || votingLoading === item.id}
                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                          isMyChoice 
                            ? 'bg-indigo-600/50 text-indigo-200 cursor-default' 
                            : hasVoted
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : `${buttonBg} text-white`
                        }`}
                      >
                        {votingLoading === item.id 
                          ? '처리 중...' 
                          : isMyChoice 
                            ? '투표함' 
                            : hasVoted 
                              ? '완료' 
                              : '투표하기'}
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`${isMyChoice ? 'bg-indigo-500' : progressBg} h-full rounded-full transition-all duration-500`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 3. GUESTBOOK SECTION */}
        <section className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-md space-y-5">
          <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-800">
            <MessageSquare className="w-5 h-5 text-pink-400" />
            <h2 className="text-lg font-semibold">방문자 방명록 (무중단 DB 검증)</h2>
          </div>

          {/* Form */}
          <form onSubmit={handleGuestbookSubmit} className="space-y-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800/60">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="작성자 닉네임"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                maxLength={50}
                className="bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 sm:w-1/3"
                required
              />
              <input
                type="text"
                placeholder="배포 응원 메시지를 남겨보세요!"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={200}
                className="bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 flex-1"
                required
              />
              <button
                type="submit"
                disabled={submitting}
                className={`px-4 py-2 text-sm font-medium rounded-lg text-white ${buttonBg} transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? '등록 중...' : '등록'}</span>
              </button>
            </div>
          </form>

          {/* Entries Feed */}
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {guestbook.length === 0 ? (
              <div className="text-center py-6 text-sm text-slate-500">
                아직 등록된 방명록이 없습니다. 첫 메시지를 남겨보세요!
              </div>
            ) : (
              guestbook.map((entry) => (
                <div key={entry.id} className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                      {entry.name}
                    </span>
                    <span className="text-sm text-slate-200">{entry.message}</span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono whitespace-nowrap">
                    {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-xs text-slate-500 pt-2 pb-6 space-y-1">
          <p>Powered by Fastify + Drizzle ORM + Vite React</p>
          <p>Designed for SoftBank Hackathon 2026 Team Amethyst (One-Tatchi Deployment Platform)</p>
        </footer>

      </div>
    </div>
  );
}
