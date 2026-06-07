# QA-SDK Master Makefile
# Inspired by Headroom: Provides a unified interface for testing, architecture governance, and CI pre-checks.

SHELL := /bin/bash

.PHONY: help install-git-hooks precheck test test-parity arch-feedback arch-impact arch-usage arch-signals sim-up sim-down

help:
	@echo "QA-SDK Development Targets:"
	@echo "  make precheck         - Run full maintenance loop (Lint, Arch Check, API Manifest) before pushing."
	@echo "  make test             - Run all unit and integration tests (requires local DB)."
	@echo "  make test-parity      - Run simulation scenarios in both in-process and HTTP modes."
	@echo "  make arch-feedback    - Run AI Feedback Loop (Syntax, Boundaries, Impact)."
	@echo "  make arch-impact      - Run Fine-Grained API Impact Analysis based on git diff."
	@echo "  make arch-usage       - Analyze package Fan-In and identify dead weight."
	@echo "  make arch-signals     - Map implicit event-driven connections across the system."
	@echo "  make sim-up           - Boot the local Docker simulation stack."
	@echo "  make sim-down         - Tear down the local Docker simulation stack."
	@echo "  make install-hooks    - Install pre-push Git hook to enforce architecture boundaries."

install-hooks:
	@mkdir -p .git/hooks
	@echo "#!/usr/bin/env bash" > .git/hooks/pre-push
	@echo "echo '🚀 Running QA-SDK pre-push maintenance checks...'" >> .git/hooks/pre-push
	@echo "bash scripts/maintenance.sh" >> .git/hooks/pre-push
	@echo "if [ \$$? -ne 0 ]; then echo '❌ Pre-push check failed. Fix architectural or linting errors before pushing.'; exit 1; fi" >> .git/hooks/pre-push
	@chmod +x .git/hooks/pre-push
	@echo "✅ Pre-push git hook installed."

precheck:
	@echo "── Running Maintenance Loop ─────────────────────────"
	bash scripts/maintenance.sh

test:
	QA_TEST_PG=1 SIM_SCENARIO_INPROC=1 pnpm -r --workspace-concurrency=1 run test

test-parity:
	@echo "── 1. Running In-Process Scenarios ──────────────────"
	SIM_SCENARIO_INPROC=1 pnpm --filter @qa-sdk/sim-scenarios run test
	@echo "── 2. Running HTTP Mode Scenarios ───────────────────"
	# Assumes sim-up has been run and services are healthy
	bash simulations/enterprise-pm/scripts/smoke.sh

arch-feedback:
	pnpm arch:feedback

arch-impact:
	pnpm arch:impact

arch-usage:
	pnpm arch:usage

arch-signals:
	pnpm arch:signals

sim-up:
	bash simulations/enterprise-pm/scripts/sim-up.sh

sim-down:
	bash simulations/enterprise-pm/scripts/sim-down.sh
