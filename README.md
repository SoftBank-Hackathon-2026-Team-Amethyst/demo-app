# demo-app

원터치 배포 시연용 **대상 앱**이다. 기능은 의도적으로 최소화한 게시판 CRUD다.

에이전트 스킬(`/janto-deploy`, `/yolo-deploy`)이 이 레포를 분석해 배포 파일을 만들고, 배포 파이프라인이 클라우드와 온프레미스에 배포한다.
템플릿(Terraform 모듈, App Chart, 재사용 워크플로)은 [`one-tatchi-platform`](https://github.com/SoftBank-Hackathon-2026-Team-Amethyst/one-tatchi-platform)에 있고, 이 레포는 태그로 참조만 한다.

## 스택

| 영역 | 구성 |
|---|---|
| FE | Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Biome, pnpm |
| BE | FastAPI, SQLAlchemy 2, psycopg 3, uv, Ruff, pytest |
| DB | PostgreSQL 17 (로컬은 docker compose) |

## 레포 구조

```
demo-app/
├── be/                         # FastAPI 백엔드
├── fe/                         # Next.js 프런트엔드
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
| GET | `/health` | DB 연결 포함 헬스체크 |
| GET | `/api/posts` | 글 목록 |
| GET | `/api/posts/{id}` | 글 조회 |
| POST | `/api/posts` | 글 작성 |
| PUT | `/api/posts/{id}` | 글 수정 |
| DELETE | `/api/posts/{id}` | 글 삭제 |

## 로컬 실행

```bash
docker compose up -d --wait                          # PostgreSQL
cd be && uv sync && uv run fastapi dev app/main.py   # :8000
cd fe && pnpm install && pnpm dev                    # :3000
```

## 환경 변수

| 이름 | 위치 | 기본값 |
|---|---|---|
| `DATABASE_URL` | be | `postgresql+psycopg://demo:demo@localhost:5432/demo` |
| `CORS_ORIGINS` | be | `["http://localhost:3000"]` |
| `API_URL` | fe (서버 런타임) | `http://localhost:8000` |

FE는 Server Component와 Server Action에서 BE를 호출하므로 `API_URL`은 실행할 때 읽힌다.

## 검사 명령

- FE: `pnpm lint`, `pnpm build`
- BE: `uv run ruff check`, `uv run pytest` (DB 필요)
