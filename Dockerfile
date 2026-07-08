# ---------- Build stage ----------
FROM node:24-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
ENV BUILDING=true
RUN pnpm build
RUN pnpm prune --prod

# ---------- Runtime stage ----------
FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=1025 \
    BODY_SIZE_LIMIT=8M \
    MAX_UPLOAD_BYTES=0 \
    LOCAL_DRIVE_DATA_DIR=/data/znl-drive

RUN mkdir -p /data/znl-drive

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 1025

CMD ["node", "build"]
