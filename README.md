# demo-app

원터치 배포 시연용 **대상 앱(Release Pulse)**이다.
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
| `DATABASE_URL` | be | `postgresql://demo:demo@localhost:5432/demo` | PostgreSQL 연결 문자열 |
| `APP_VERSION` | be | `v1.0.0` | 배포 버전 (v2.0.0 시 초록 테마로 자동 전환) |
| `APP_ENV` | be | `production` | 실행 환경 (`development` / `production`) |
| `PORT` | be | `8000` | 서버 수신 포트 |
| `VITE_API_URL` | fe | `http://localhost:8000` | 프런트엔드 개발 프록시 타겟 |

## 검사 명령

- FE: `cd fe && pnpm build`
- BE: `cd be && pnpm build`
