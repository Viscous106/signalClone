# One image, one process: the API serves the built frontend.

# ---- build the frontend to static files ----
FROM node:22-alpine AS web
RUN corepack enable
WORKDIR /app/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml* frontend/pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm build

# ---- run the API, serving that bundle ----
FROM python:3.13-slim
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

COPY backend/pyproject.toml backend/
RUN pip install --no-cache-dir ./backend

COPY backend/ backend/
COPY --from=web /app/frontend/out frontend/out

# The database always lives at /data. Mount a disk there and it persists;
# without one it is just a directory in the container and rebuilds from the
# seed on each boot. No config change either way.
# (Deliberately no VOLUME: hosts ignore it, and locally it silently creates
# anonymous volumes that make an ephemeral setup look persistent.)
RUN mkdir -p /data
ENV DATABASE_URL=sqlite:////data/signal.db

# Declared so the EXPOSE below and the bound port always agree; hosts that
# inject their own PORT override it and the CMD follows.
ENV PORT=8000
EXPOSE 8000

WORKDIR /app/backend
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
