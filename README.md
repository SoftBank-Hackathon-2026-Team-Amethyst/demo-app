# demo-app

원터치 배포 시연용 **Demo-App**이다.
상단 **실시간 배포 상태 & 버전 모니터링**, 중단 **실시간 배포 전략 투표**, 하단 **방명록(무중단 DB CRUD 검증)** 기능을 제공한다.

에이전트 스킬(`/janto-deploy`, `/yolo-deploy`)이 이 레포를 분석해 배포 파일을 만들고, 배포 파이프라인이 클라우드와 온프레미스에 배포한다.
템플릿(Terraform 모듈, App Chart, 재사용 워크플로)은 [`one-tatchi-platform`](https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform)에 있고, 이 레포는 태그로 참조만 한다.

## 스택

| 영역 | 구성 |
|---|---|
| FE | Vite + React 19, TypeScript, Tailwind CSS 4, Lucide Icons, pnpm |
| BE | Fastify 5, TypeScript, Drizzle ORM, postgres.js, Pino, pnpm |
| DB | PostgreSQL 17 (로컬은 docker compose, 미연결 시 메모리 fallback 안전망 제공) |

## 레포 구조

```
demo-app/
├── be/                         # Fastify 백엔드
├── fe/                         # Vite + React 프런트엔드
├── db/                         # 스키마 (init.sql)
│
│   ── 아래는 에이전트가 만드는 배포 산출물 자리 ──
├── deploy/                     # App Chart 값 파일 (values-be.yaml, values-fe.yaml)
├── infra/envs/<대상>/           # Terraform 루트: 원격 모듈 참조 + terraform.tfvars
├── .deploy/                    # config.yaml (targets · compliance · template_version), brief.md, 배포 기록
└── .github/workflows/          # 재사용 워크플로를 호출하는 얇은 워크플로
```

## API

| Method | Path | 설명 |
|---|---|---|
| GET | `/health` | DB 연결 상태 포함 헬스체크 (Readiness) |
| GET | `/healthz/liveness` | 프로세스 생존 헬스체크 (Liveness) |
| GET | `/api/info` | 버전, 테마, 가동시간(Uptime), 호스트명, DB 상태 등 런타임 메타데이터 |
| GET | `/api/votes` | 투표 항목 및 실시간 득표율 조회 |
| POST | `/api/votes/:id` | 특정 항목 투표 수 증가 |
| GET | `/api/guestbook` | 방문자 방명록 목록 조회 (최신순) |
| POST | `/api/guestbook` | 방명록 신규 메시지 등록 |
| GET | `/api/metrics` | 파드별 최근 60초 요청 · CPU · 메모리 집계 (대시보드 차트) |
| GET | `/metrics` | Prometheus 형식 지표 (FE가 프록시하지 않음) |
| GET | `/api/chaos` | 장애 주입 상태 조회 (`enabled`는 `CHAOS_ENABLED` 값) |
| POST | `/api/chaos`, `/api/chaos/reset` | 장애 주입 변경 · 초기화. **`CHAOS_ENABLED=true`일 때만 등록**된다 (인증 없는 시연 기능) |

`/health`는 실제 DB에 닿지 않으면(메모리 fallback) **503**을 돌려 승격 smoke와 Kubernetes readiness가 장애를 본다. 장애 주입의 DB 단절 시뮬레이션은 readiness를 떨어뜨리지 않고 `chaosDbError`로만 표시된다. 헬스 경로는 지연 · 에러율 주입 대상이 아니다.

## 로컬 실행

```bash
docker compose up -d                                 # PostgreSQL 17 기동
cd be && pnpm install && pnpm dev                    # :8000
cd fe && pnpm install && pnpm dev                    # :3000
```

> **Note**: PostgreSQL 컨테이너가 없어도 백엔드는 인메모리 fallback 모드로 즉시 기동되므로 데모 시연이 중단되지 않습니다.

## 환경 변수

| 이름 | 위치 | 기본값 | 설명 |
|---|---|---|---|
| `DATABASE_URL` | be | `postgresql://demo:demo@localhost:5432/demo` | PostgreSQL 연결 문자열 (배포에서는 Secret `demo-app-db`) |
| `APP_VERSION` | be | `v1.0.0` | 배포 버전 (v2.0.0 시 초록 테마로 자동 전환) |
| `NODE_ENV` | be | — | 실행 환경. 이미지에서는 `production` |
| `LOG_LEVEL` | be | `info` | Pino 로그 레벨 (배포 값 파일은 `warn`) |
| `CHAOS_ENABLED` | be | (비움) | `true`면 장애 주입 변경 API를 연다. 시연이 끝나면 `deploy/values-be.yaml`에서 끈다 |
| `PORT` | be | `8000` | 서버 수신 포트 |
| `VITE_API_URL` | fe | `http://localhost:8000` | 프런트엔드 개발 프록시 타겟 |

## 검사 명령

- FE: `cd fe && pnpm lint && pnpm build`
- BE: `cd be && pnpm lint && pnpm test && pnpm build`
