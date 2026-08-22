# Signal Clone — dev tasks
# Backend on :8000 (FastAPI), frontend on :3000 (Next.js)

BACKEND  := backend
FRONTEND := frontend
PY       := $(BACKEND)/.venv/bin/python
DB       := $(BACKEND)/signal.db

.DEFAULT_GOAL := help
.PHONY: help setup run run-api run-web test test-api test-web db remove-db reset-db

help: ## Show this help
	@echo "Signal Clone"
	@echo
	@grep -E '^[a-z-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

setup: ## Install backend + frontend dependencies
	@command -v uv   >/dev/null || { echo "uv not found: https://docs.astral.sh/uv/"; exit 1; }
	@command -v pnpm >/dev/null || { echo "pnpm not found: npm i -g pnpm"; exit 1; }
	@echo "==> backend"
	cd $(BACKEND) && uv venv --python 3.13 && uv pip install -e ".[dev]"
	@echo "==> frontend"
	cd $(FRONTEND) && pnpm install
	@echo "==> done. 'make db' to seed, then 'make run'."

run: ## Run backend and frontend together (Ctrl-C stops both)
	@test -x $(PY) || { echo "No venv. Run 'make setup' first."; exit 1; }
	@echo "api -> http://localhost:8000/docs"
	@echo "web -> http://localhost:3000"
	@trap 'trap - INT TERM EXIT; kill 0' INT TERM EXIT; \
		( cd $(BACKEND) && .venv/bin/uvicorn app.main:app --reload --port 8000 ) & \
		( cd $(FRONTEND) && pnpm dev ) & \
		wait

run-api: ## Run only the FastAPI backend
	cd $(BACKEND) && .venv/bin/uvicorn app.main:app --reload --port 8000

run-web: ## Run only the Next.js frontend
	cd $(FRONTEND) && pnpm dev

test: test-api test-web ## Run every test suite

test-api: ## Backend tests (pytest)
	@echo "==> pytest"
	cd $(BACKEND) && .venv/bin/python -m pytest -q

test-web: ## Frontend tests (vitest)
	@echo "==> vitest"
	cd $(FRONTEND) && pnpm test

db: ## Create the database and seed it (safe to re-run)
	@test -x $(PY) || { echo "No venv. Run 'make setup' first."; exit 1; }
	@echo "==> $(DB)"
	@cd $(BACKEND) && .venv/bin/python -m app.cli init

remove-db: ## Delete the database file (stop the server first)
	@if ss -tln 2>/dev/null | grep -q ':8000 '; then \
		echo "Refusing: something is serving on :8000."; \
		echo "SQLite keeps writing to a deleted file, so the running server would"; \
		echo "silently diverge from the one you reseed. Stop it, then retry."; \
		exit 1; fi
	@if [ -f $(DB) ]; then \
		echo "removing $(DB) ($$(du -h $(DB) | cut -f1))"; rm -f $(DB); \
		else echo "no database at $(DB)"; fi

reset-db: remove-db db ## Delete and reseed from scratch
