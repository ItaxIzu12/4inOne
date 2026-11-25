# 4inOne Backend (Django + gunicorn) für den Betrieb mit Docker Compose (deploy/docker/compose.yml).
# Build-Kontext ist das Repository (siehe .dockerignore): docker compose -f deploy/docker/compose.yml build
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Eigener Benutzer ohne Login und ohne Schreibrecht auf den Code; geschrieben wird nur nach /data (Volume).
RUN groupadd --system --gid 10001 app && useradd --system --uid 10001 --gid app --home-dir /app --shell /usr/sbin/nologin app

WORKDIR /app
COPY backend/requirements.txt ./requirements.txt
RUN pip install -r requirements.txt

COPY backend/ ./
RUN mkdir -p /data/private_media && chown -R app:app /data

USER app
EXPOSE 8000

# 2 Worker reichen für eine Person bzw. Familie (docs/ARCHITECTURE.md § 7); Timeout wie im systemd-Dienst.
CMD ["gunicorn", "config.wsgi:application", "--workers", "2", "--timeout", "30", "--bind", "0.0.0.0:8000", "--access-logfile", "-"]
