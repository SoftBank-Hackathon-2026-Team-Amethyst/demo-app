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
| GET | `/api/load/config` | CPU 부하 테스트 활성화 여부와 UI 제한값 |
| POST | `/api/load/cpu` | CPU 연산 한 건. `LOAD_TEST_ENABLED=true`일 때 등록, `intensity`: `light` / `medium` / `heavy` |
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
| `LOAD_TEST_ENABLED` | be | `false` | CPU 부하 API 활성화. `NODE_ENV`와 독립적이며 test · prod 모두 사용 가능. 현재 공통 배포 값은 `true` |
| `PORT` | be | `8000` | 서버 수신 포트 |
| `VITE_API_URL` | fe | `http://localhost:8000` | 프런트엔드 개발 프록시 타겟 |

## CPU 오토스케일 테스트

공통 `deploy/values-be.yaml`의 `env.LOAD_TEST_ENABLED: "true"`로 test와 prod 모두 CPU 부하 테스트를 켠다. 끄려면 `"false"`로 바꾸고 재배포한다. 로컬에서는 BE 환경변수 `LOAD_TEST_ENABLED=true`로 켠다. `CHAOS_ENABLED`와 독립적인 기능이다.

화면의 **Demo Tools → CPU 부하 테스트**에서 5 / 10 / 20 RPS, 약 / 중 / 강, 1 / 3 / 5분을 선택해 시작한다. 남은 시간, 실제 전송 RPS와 성공 · 실패 · 429 응답 수를 표시한다. 중지, 전체 초기화, 패널 닫기, 탭 숨김, 시간 만료 시 요청 전송이 멈춘다. 이미 시작한 서버 작업은 완료되거나 2초 제한 안에 종료된다. 이 조작은 현재 브라우저가 보내는 부하를 제어한다.

CPU 연산은 재사용 Worker Thread 1개에서 수행하고 파드당 실행 중 · 대기 요청은 합계 8개로 제한한다(초과 시 429). 요청당 연산 횟수가 고정되어 파드가 늘면 같은 전체 부하가 분산된다. DB를 사용하지 않고 장애 주입 훅의 영향을 받지 않는다. 이 데모 API에는 인증이 없으므로 활성화된 공개 환경에서는 다른 방문자도 요청할 수 있다. UI의 RPS · 실행 시간 제한은 브라우저별 제한이며 서버 전체 사용량 제한은 아니다.

AWS BE 기본값은 CPU request `100m`, HPA 목표 70%, 파드 2~6개다. 즉 목표 CPU는 파드당 약 `70m`이다. 화면 CPU는 프로세스의 1코어 기준 수치이며 HPA 비율과 다르다. 화면 파드 목록도 폴링으로 관측한 목록이므로 실제 확장 여부는 `kubectl get hpa,pods -n test` 또는 `-n prod`와 Grafana로 확인한다. 먼저 10 RPS · 중간 강도 · 3분으로 측정하고 필요하면 강도를 올린다. 차트의 축소 안정화 시간은 300초이므로 중지 후 축소에는 시간이 걸린다. 온프레미스는 현재 HPA가 꺼져 있어 CPU 부하는 가능하지만 자동 확장은 별도 활성화가 필요하다.

## 검사 명령

- FE: `cd fe && pnpm lint && pnpm build`
- BE: `cd be && pnpm lint && pnpm test && pnpm build`
