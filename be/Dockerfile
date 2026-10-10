# Stage 1: Build (러너 호스트 네이티브에서 초고속 빌드)
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src

RUN pnpm run build

# Stage 2: 운영 의존성만 설치 (순수 JS 패키지이므로 호스트 네이티브에서 설치 후 복사)
FROM --platform=$BUILDPLATFORM node:22-alpine AS deps

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile

# Stage 3: Runtime
FROM node:22-alpine AS runner

# 실행에는 node만 필요하다. 이미지에 기본으로 든 npm · corepack · yarn은 지운다 (이미지 취약점 검사 대상을 줄인다).
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-* \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000
ENV HOST=0.0.0.0

COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# App Chart는 숫자 UID의 non-root 실행을 강제한다 (node 이미지의 node = 1000).
USER 1000

EXPOSE 8000

HEALTHCHECK --interval=5s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8000/health || exit 1

CMD ["node", "dist/index.js"]
