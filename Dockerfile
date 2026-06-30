# ---------- Build stage ----------
FROM denoland/deno:debian AS builder

WORKDIR /app

# Vite/SvelteKit build runs via Node (Deno's npm runner breaks tsconfig extends resolution).
RUN apt-get update && apt-get install -y --no-install-recommends nodejs && rm -rf /var/lib/apt/lists/*

COPY package.json deno.json deno.lock ./
RUN deno install

COPY . .
ENV BUILDING=true
RUN deno task build

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
