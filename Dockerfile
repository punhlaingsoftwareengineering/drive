# ---------- Build stage ----------
FROM node:24-alpine AS builder

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build


# ---------- Runtime stage ----------
FROM node:24-alpine

WORKDIR /app
RUN corepack enable

ENV NODE_ENV=production
# 1. Update the environment variable for your Node app
ENV PORT=1025

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# 2. Update the exposed port for Docker documentation/mapping
EXPOSE 1025

CMD ["node", "build"]
