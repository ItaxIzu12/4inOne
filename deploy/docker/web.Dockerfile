# Lumiknot Web (Angular-Build + nginx) für Docker Compose (deploy/docker/compose.yml). nginx liefert die App aus,
# reicht /api/ und den Admin an das Backend weiter und beendet HTTPS.
FROM node:24-bookworm-slim AS build
WORKDIR /src
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npx ng build

# Django-Admin-Dateien (collectstatic). Gleiche Schritte wie backend.Dockerfile, damit Docker die pip-Schicht wiederverwendet.
FROM python:3.13-slim AS static
ENV PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app
COPY backend/requirements.txt ./requirements.txt
RUN pip install -r requirements.txt
COPY backend/ ./
# Nur zum Einsammeln der Dateien: Wegwerf-Schlüssel, keine Datenbank nötig
RUN SECRET_KEY=collectstatic-only DEBUG=False STATIC_ROOT=/app/staticfiles python manage.py collectstatic --noinput

FROM nginx:1.28-alpine
# Konfiguration als Vorlage: das nginx-Image setzt beim Start ${SERVER_NAME} und ${ADMIN_URL_PATH} ein
# (nur diese beiden; nginx-eigene $variablen bleiben unberührt, siehe NGINX_ENVSUBST_FILTER in compose.yml).
RUN rm -f /etc/nginx/conf.d/default.conf
COPY deploy/docker/nginx/4inone.conf.template /etc/nginx/templates/4inone.conf.template
COPY deploy/docker/nginx/proxy.conf /etc/nginx/snippets/4inone-proxy.conf
COPY deploy/nginx/snippets/4inone-security-headers.conf /etc/nginx/snippets/4inone-security-headers.conf
COPY --from=build /src/dist/frontend/browser/ /usr/share/nginx/html/
COPY --from=static /app/staticfiles/ /usr/share/nginx/static/
EXPOSE 80 443
