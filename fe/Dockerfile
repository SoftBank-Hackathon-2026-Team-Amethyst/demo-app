# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src

RUN pnpm run build

# Stage 2: Serve
# App Chart는 non-root · 읽기 전용 루트 파일시스템을 강제한다. 비특권 nginx(UID 101, 임시 파일은 /tmp)를 쓴다.
FROM nginxinc/nginx-unprivileged:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
