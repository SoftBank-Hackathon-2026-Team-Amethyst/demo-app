export type Language = 'en' | 'ja' | 'ko';

export interface Translations {
  title: string;
  newVersionSwitched: (version: string) => string;
  demoTools: string;
  status: {
    ok: { label: string; headline: string };
    degraded: { label: string; headline: string };
    down: { label: string; headline: string };
  };
  currentVersion: string;
  uptime: string;
  formatUptime: (seconds: number) => string;
  respondingPod: string;
  serviceStatusTitle: string;
  services: {
    frontend: string;
    backendApi: string;
    database: string;
  };
  serviceDetails: {
    noResponse: string;
    memoryMode: string;
    unavailable: string;
  };
  rolloutTitle: string;
  rolloutInProgress: (count: number) => string;
  singleVersionStable: string;
  trafficServing: (percent: number) => string;
  sampleBasis: string;
  availabilityTitle: string;
  availabilityOk: string;
  availabilityFail: (count: number) => string;
  responseTimeTitle: string;
  responseTimeP95: (p95: number) => string;
  responseTimeClient: string;
  rpsTitle: string;
  rpsTotal: (total: number) => string;
  waitingMetrics: string;
  trafficChartTitle: string;
  trafficChartAria: string;
  thirtySecAgo: string;
  now: string;
  podsTitle: (count: number) => string;
  collectingPods: string;
  cpu: string;
  memory: string;
  historyTitle: string;
  historyHint: string;
  noResponseTooltip: string;
  failCountHistory: (count: number) => string;
  voteTitle: string;
  voteTotal: (total: number) => string;
  voteOptions: Record<string, string>;
  myChoice: string;
  voting: string;
  alreadyVotedNotice: string;
  canVoteOnce: string;
  guestbookTitle: string;
  namePlaceholder: string;
  messagePlaceholder: string;
  submitting: string;
  submit: string;
  emptyGuestbook: string;
  adminTitle: string;
  trafficGenTitle: string;
  trafficRunning: (rps: number) => string;
  stopped: string;
  trafficGenDesc: string;
  stopButton: string;
  chaosTitle: string;
  applying: string;
  chaosDesc: string;
  chaosDisabledNotice: string;
  latencySpike: string;
  noLatency: string;
  errorRateTitle: string;
  normal: string;
  errorRateLabel: (percent: number) => string;
  dbFailureTitle: string;
  memoryFallbackDesc: string;
  dbDisconnected: string;
  dbConnected: string;
  resetAll: string;
  resetDesc: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    title: 'Real-Time Deployment Status',
    newVersionSwitched: (v) => `Switched to new version ${v}`,
    demoTools: 'Demo Tools',
    status: {
      ok: { label: 'Healthy', headline: 'All services are operating normally' },
      degraded: { label: 'Warning', headline: 'Running in fallback mode without DB' },
      down: { label: 'Outage', headline: 'Cannot connect to server' },
    },
    currentVersion: 'Current Version',
    uptime: 'Uptime',
    formatUptime: (s) => {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      if (h > 0) return `${h}h ${m}m`;
      if (m > 0) return `${m}m ${sec}s`;
      return `${sec}s`;
    },
    respondingPod: 'Active Pod',
    serviceStatusTitle: 'Service Status',
    services: {
      frontend: 'Frontend',
      backendApi: 'Backend API',
      database: 'Database',
    },
    serviceDetails: {
      noResponse: 'No response',
      memoryMode: 'In-Memory Mode',
      unavailable: 'Unavailable',
    },
    rolloutTitle: 'Rollout Traffic Distribution (Blue/Green · Canary)',
    rolloutInProgress: (c) => `Rollout transition in progress (${c} versions active)`,
    singleVersionStable: 'Stable single version (100% serving)',
    trafficServing: (pct) => `${pct}% traffic serving`,
    sampleBasis: 'Based on last 60 response samples',
    availabilityTitle: 'Availability (Last 1m)',
    availabilityOk: 'Responded without interruption',
    availabilityFail: (c) => `Failed to respond ${c} times`,
    responseTimeTitle: 'Response Time (Median)',
    responseTimeP95: (p95) => `Top 5% slowest requests: ${p95}ms`,
    responseTimeClient: 'Measured in browser',
    rpsTitle: 'Requests Per Second',
    rpsTotal: (tot) => `Total ${tot} requests in last 60s`,
    waitingMetrics: 'Waiting for metrics...',
    trafficChartTitle: 'Traffic (Last 30s)',
    trafficChartAria: 'Requests per second chart',
    thirtySecAgo: '30s ago',
    now: 'Now',
    podsTitle: (c) => `Pods ${c || ''}`.trim(),
    collectingPods: 'Collecting pod information...',
    cpu: 'CPU',
    memory: 'Memory',
    historyTitle: 'Response History (Last 60s)',
    historyHint: 'Bar height = response time · Color = Pod',
    noResponseTooltip: 'No response',
    failCountHistory: (c) => `${c} response failures`,
    voteTitle: 'Which deployment strategy do you prefer?',
    voteTotal: (tot) => `Total ${tot} votes`,
    voteOptions: {
      rolling: 'Zero-Downtime Rolling Update',
      blue_green: 'Blue/Green Deployment',
      canary: 'Canary Deployment',
    },
    myChoice: 'My Choice',
    voting: 'Voting…',
    alreadyVotedNotice: 'Thank you for voting! One vote per person.',
    canVoteOnce: 'You can only vote once.',
    guestbookTitle: 'Leave a Message',
    namePlaceholder: 'Name',
    messagePlaceholder: 'Cheer for deployment',
    submitting: 'Submitting…',
    submit: 'Post',
    emptyGuestbook: 'No messages yet. Be the first to leave one!',
    adminTitle: 'Demo Admin Panel',
    trafficGenTitle: '⚡ Traffic Load Generator',
    trafficRunning: (rps) => `${rps} RPS Active`,
    stopped: 'Stopped',
    trafficGenDesc: 'Sends background requests from the browser to stimulate traffic charts and CPU metrics.',
    stopButton: 'Stop',
    chaosTitle: '🔥 Chaos Engineering',
    applying: 'Applying...',
    chaosDesc: 'Inject artificial failures into the server to demonstrate real-time anomaly detection and alerts.',
    chaosDisabledNotice: 'Chaos simulation is disabled in this environment (BE CHAOS_ENABLED is not true). Buttons below are inactive.',
    latencySpike: 'Latency Spike Injection',
    noLatency: 'No Latency',
    errorRateTitle: '500 Error Rate Injection',
    normal: 'Normal',
    errorRateLabel: (pct) => `${pct}% Error`,
    dbFailureTitle: 'DB Connection Failure Simulation',
    memoryFallbackDesc: 'Triggers in-memory fallback mode',
    dbDisconnected: 'DB Disconnected',
    dbConnected: 'DB Connected',
    resetAll: '✨ Reset All Traffic & Chaos',
    resetDesc: 'Stops load generator and immediately clears all injected chaos failures.',
  },
  ja: {
    title: 'リアルタイムデプロイ状況',
    newVersionSwitched: (v) => `新バージョン ${v} に切り替わりました`,
    demoTools: 'デモツール',
    status: {
      ok: { label: '正常', headline: 'すべてのサービスが正常に動作しています' },
      degraded: { label: '注意', headline: 'DBなしの縮退モードで動作中です' },
      down: { label: '障害', headline: 'サーバーに接続できません' },
    },
    currentVersion: '現在のバージョン',
    uptime: '稼働時間',
    formatUptime: (s) => {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      if (h > 0) return `${h}時間 ${m}分`;
      if (m > 0) return `${m}分 ${sec}秒`;
      return `${sec}秒`;
    },
    respondingPod: '応答中のポッド',
    serviceStatusTitle: 'サービス状態',
    services: {
      frontend: 'フロントエンド',
      backendApi: 'バックエンド API',
      database: 'データベース',
    },
    serviceDetails: {
      noResponse: '応答なし',
      memoryMode: 'メモリモード',
      unavailable: '確認不可',
    },
    rolloutTitle: 'デプロイロールアウト トラフィック分散 (Blue/Green · Canary)',
    rolloutInProgress: (c) => `ロールアウト切替中 (${c}バージョンが共存)`,
    singleVersionStable: '単一バージョン安定稼働 (100% 配信)',
    trafficServing: (pct) => `${pct}% トラフィック配信`,
    sampleBasis: '直近60回の応答サンプル基準',
    availabilityTitle: '可用性 (直近1分)',
    availabilityOk: '途切れず応答しました',
    availabilityFail: (c) => `${c}回 応答に失敗しました`,
    responseTimeTitle: '応答時間 (中央値)',
    responseTimeP95: (p95) => `上位5%低速リクエスト ${p95}ms`,
    responseTimeClient: 'ブラウザ計測値',
    rpsTitle: '秒間リクエスト数',
    rpsTotal: (tot) => `直近60秒で計 ${tot}件`,
    waitingMetrics: 'メトリクス待機中...',
    trafficChartTitle: 'トラフィック (直近30秒)',
    trafficChartAria: '秒間リクエスト数グラフ',
    thirtySecAgo: '30秒前',
    now: '現在',
    podsTitle: (c) => `ポッド ${c || ''}`.trim(),
    collectingPods: 'ポッド情報を収集中です',
    cpu: 'CPU',
    memory: 'メモリ',
    historyTitle: '応答履歴 (直近60秒)',
    historyHint: 'バーの高さ = 応答時間 · 色 = ポッド',
    noResponseTooltip: '応答なし',
    failCountHistory: (c) => `応答失敗 ${c}回`,
    voteTitle: 'どのデプロイ方式が一番好きですか？',
    voteTotal: (tot) => `計 ${tot}票`,
    voteOptions: {
      rolling: '無停止ローリングアップデート (Rolling Update)',
      blue_green: 'ブルー/グリーンデプロイ (Blue/Green)',
      canary: 'カナリアデプロイ (Canary Deployment)',
    },
    myChoice: '自分の投票',
    voting: '投票中…',
    alreadyVotedNotice: 'ご投票ありがとうございます。1人1票です。',
    canVoteOnce: '一度だけ投票できます。',
    guestbookTitle: 'メッセージを残す',
    namePlaceholder: 'お名前',
    messagePlaceholder: 'デプロイ応援メッセージ',
    submitting: '送信中…',
    submit: '投稿する',
    emptyGuestbook: 'まだメッセージがありません。最初のメッセージを投稿してみましょう！',
    adminTitle: 'デモ管理者パネル',
    trafficGenTitle: '⚡ トラフィック負荷ジェネレーター',
    trafficRunning: (rps) => `${rps} RPS 稼働中`,
    stopped: '停止',
    trafficGenDesc: 'ブラウザからリアルタイムでバックグラウンドリクエストを送信し、トラフィックグラフとCPU使用率を刺激します。',
    stopButton: '停止',
    chaosTitle: '🔥 障害注入 (Chaos Engineering)',
    applying: '適用中...',
    chaosDesc: 'サーバーに意図的な障害を発生させ、ダッシュボードのリアルタイム異常検知とアラートを実演します。',
    chaosDisabledNotice: 'この環境では障害注入が無効化されています (BEの CHAOS_ENABLED が true ではありません)。',
    latencySpike: '意図的なレイテンシ注入 (Latency Spike)',
    noLatency: '遅延なし',
    errorRateTitle: '500エラー率注入 (Error Rate)',
    normal: '正常',
    errorRateLabel: (pct) => `${pct}% エラー`,
    dbFailureTitle: 'DB接続障害シミュレーション',
    memoryFallbackDesc: 'メモリFallbackモードを誘発',
    dbDisconnected: 'DB切断中',
    dbConnected: 'DB正常接続',
    resetAll: '✨ すべてのトラフィック＆障害を一括リセット (Reset)',
    resetDesc: '負荷ジェネレーターを停止し、注入されたすべての障害を即座に解除します。',
  },
  ko: {
    title: '실시간 배포 현황',
    newVersionSwitched: (v) => `새 버전 ${v}으로 전환됨`,
    demoTools: '시연 도구',
    status: {
      ok: { label: '정상', headline: '모든 서비스가 정상이에요' },
      degraded: { label: '주의', headline: 'DB 없이 임시 모드로 동작 중이에요' },
      down: { label: '장애', headline: '서버에 연결할 수 없어요' },
    },
    currentVersion: '현재 버전',
    uptime: '가동 시간',
    formatUptime: (s) => {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      if (h > 0) return `${h}시간 ${m}분`;
      if (m > 0) return `${m}분 ${sec}초`;
      return `${sec}초`;
    },
    respondingPod: '응답 중인 파드',
    serviceStatusTitle: '서비스 상태',
    services: {
      frontend: '프런트엔드',
      backendApi: '백엔드 API',
      database: '데이터베이스',
    },
    serviceDetails: {
      noResponse: '응답 없음',
      memoryMode: '메모리 모드',
      unavailable: '확인 불가',
    },
    rolloutTitle: '배포 롤아웃 트래픽 분배 (Blue/Green · Canary)',
    rolloutInProgress: (c) => `롤아웃 전환 진행 중 (${c}개 버전 공존)`,
    singleVersionStable: '단일 버전 안정 상태 (100% 서빙)',
    trafficServing: (pct) => `${pct}% 트래픽 서빙`,
    sampleBasis: '최근 60회 응답 샘플 기준',
    availabilityTitle: '가용률 (최근 1분)',
    availabilityOk: '끊김 없이 응답했어요',
    availabilityFail: (c) => `${c}번 응답하지 못했어요`,
    responseTimeTitle: '응답 시간 (중앙값)',
    responseTimeP95: (p95) => `상위 5% 느린 요청 ${p95}ms`,
    responseTimeClient: '브라우저에서 측정한 값',
    rpsTitle: '초당 요청 수',
    rpsTotal: (tot) => `최근 60초 총 ${tot}건`,
    waitingMetrics: '메트릭을 기다리는 중',
    trafficChartTitle: '트래픽 (최근 30초)',
    trafficChartAria: '초당 요청 수 그래프',
    thirtySecAgo: '30초 전',
    now: '지금',
    podsTitle: (c) => `파드 ${c || ''}`.trim(),
    collectingPods: '파드 정보를 수집하는 중이에요',
    cpu: 'CPU',
    memory: '메모리',
    historyTitle: '응답 기록 (최근 60초)',
    historyHint: '막대 높이 = 응답 시간 · 색 = 파드',
    noResponseTooltip: '응답 없음',
    failCountHistory: (c) => `응답 실패 ${c}회`,
    voteTitle: '어떤 배포 방식이 가장 좋아요?',
    voteTotal: (tot) => `총 ${tot}표`,
    voteOptions: {
      rolling: '무중단 롤링 배포 (Rolling Update)',
      blue_green: '블루-그린 배포 (Blue/Green)',
      canary: '카나리 배포 (Canary Deployment)',
    },
    myChoice: '내 선택',
    voting: '투표 중…',
    alreadyVotedNotice: '투표해 주셔서 감사해요. 1인 1표예요.',
    canVoteOnce: '한 번만 투표할 수 있어요.',
    guestbookTitle: '한마디 남기기',
    namePlaceholder: '이름',
    messagePlaceholder: '배포 응원 한마디',
    submitting: '등록 중…',
    submit: '남기기',
    emptyGuestbook: '아직 남겨진 글이 없어요. 첫 글을 남겨보세요.',
    adminTitle: '시연 관리자 패널',
    trafficGenTitle: '⚡ 트래픽 부하 생성기',
    trafficRunning: (rps) => `${rps} RPS 동작 중`,
    stopped: '정지',
    trafficGenDesc: '브라우저에서 실시간 백그라운드 요청을 전송하여 트래픽 차트와 CPU 수치를 자극합니다.',
    stopButton: '정지',
    chaosTitle: '🔥 장애 주입 (Chaos Engineering)',
    applying: '적용 중...',
    chaosDesc: '서버에 인위적 장애를 일으켜 대시보드의 실시간 이상 감지 및 알람을 시연합니다.',
    chaosDisabledNotice: '이 환경은 장애 주입이 꺼져 있습니다 (BE `CHAOS_ENABLED`가 true가 아님). 아래 버튼은 동작하지 않습니다.',
    latencySpike: '인위적 지연 주입 (Latency Spike)',
    noLatency: '지연 없음',
    errorRateTitle: '500 에러율 주입 (Error Rate)',
    normal: '정상',
    errorRateLabel: (pct) => `${pct}% 에러`,
    dbFailureTitle: 'DB 연결 장애 시뮬레이션',
    memoryFallbackDesc: '메모리 Fallback 모드 유도',
    dbDisconnected: 'DB 단절됨',
    dbConnected: 'DB 연결 정상',
    resetAll: '✨ 모든 트래픽 & 장애 원클릭 정상화 (Reset)',
    resetDesc: '부하 생성기를 끄고 모든 주입 장애를 즉시 해제합니다.',
  },
};

export const LANGUAGE_OPTIONS: { key: Language; label: string; short: string }[] = [
  { key: 'en', label: 'English', short: 'EN' },
  { key: 'ja', label: '日本語', short: 'JA' },
  { key: 'ko', label: '한국어', short: 'KO' },
];
