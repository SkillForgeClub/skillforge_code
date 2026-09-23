# Backend image for Render deployment. Installs the compilers/interpreters the code judge
# needs directly into this container (host-mode judging - see server/judge.ts), so submissions
# work out of the box with no extra setup on Render.
#
# Note on judge isolation: this container does NOT support JUDGE_RUNTIME=docker (nested
# Docker-in-Docker isn't available on Render's standard web services, same limitation as most
# PaaS platforms - Heroku, Railway, Vercel share it too, it's not Render-specific). Default
# JUDGE_RUNTIME=host (process-level isolation via ulimit + timeouts) works fully here and is
# what this image is built for. If you need true per-submission container isolation, run the
# judge on a separate small VM with Docker installed (see README "Docker judge isolation") and
# point this Render service at it, or run the whole backend there instead of on Render.

FROM node:20-bookworm-slim

# Compilers/runtimes for the judge (Python/C/C++/Java) - same toolchain as local dev.
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 \
        gcc \
        g++ \
        openjdk-17-jdk-headless \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Builds the frontend into dist/ too, so this single service can serve both API and frontend
# if you choose the combined-deployment path instead of a separate Vercel frontend.
RUN npm run build

ENV NODE_ENV=production
EXPOSE 8787

# Use the locally installed tsx (not npx which re-resolves on every start).
# Render sets $PORT automatically; server/index.ts already reads it (falls back to 8787 locally).
CMD ["node_modules/.bin/tsx", "server/index.ts"]
