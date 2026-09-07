FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY agent/ ./agent/
COPY prompts/ ./prompts/

# data/ holds the SQLite file and the export inbox - mount it as a volume so
# neither survives only inside the container.
RUN mkdir -p data/inbox
VOLUME ["/app/data"]

EXPOSE 8000
HEALTHCHECK --interval=60s --timeout=5s --start-period=10s \
  CMD python -c "import httpx2; httpx2.get('http://localhost:8000/health').raise_for_status()"

CMD ["uvicorn", "agent.api:app", "--host", "0.0.0.0", "--port", "8000"]
