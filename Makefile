.PHONY: dev test lint ingest report deploy clean

VENV ?= .venv
PY   ?= python3

dev:  ## install deps and create the database
	$(PY) -m pip install -r requirements-dev.txt
	$(PY) -m agent.cli init-db
	@echo "run: make ingest && uvicorn agent.api:app --reload"

serve:
	uvicorn agent.api:app --reload --port 8000

test:
	$(PY) -m pytest tests/ -q --cov=agent.analytics --cov=agent.ingest \
		--cov=agent.llm --cov=agent.reporting --cov-report=term-missing

ingest:
	$(PY) -m agent.cli ingest

report:
	$(PY) -m agent.cli report --days 7

report-send:
	$(PY) -m agent.cli report --days 7 --send

deploy:
	docker build -t storefront-agent .
	@echo "built. run with: docker run --env-file .env -p 8000:8000 -v \$$PWD/data:/app/data storefront-agent"

clean:
	rm -rf .pytest_cache .coverage __pycache__ */__pycache__ */*/__pycache__
