# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

COPY tsconfig.json ./
COPY src ./src

RUN pnpm run build

# Stage 2: Runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000
ENV HOST=0.0.0.0

RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod

COPY --from=builder /app/dist ./dist

# App Chart는 숫자 UID의 non-root 실행을 강제한다 (node 이미지의 node = 1000).
USER 1000

EXPOSE 8000

HEALTHCHECK --interval=5s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8000/health || exit 1

CMD ["node", "dist/index.js"]
