# syntax=docker/dockerfile:1
# Backend Django -> image distroless Python, non-root.
# Django 6 exige Python >= 3.12 : build et runtime en Python 3.13 (Debian 13).

# ---- Build : installe les dépendances dans /deps (pip n'existe pas au runtime)
FROM python:3.13-slim-trixie AS build
WORKDIR /app
COPY requirements.txt .
# gunicorn : serveur WSGI de production (absent de requirements.txt)
RUN pip install --no-cache-dir --target /deps -r requirements.txt gunicorn==26.2.0
COPY . .

# ---- Runtime : interpréteur Python seul, sans shell ni pip, utilisateur 65532
FROM gcr.io/distroless/python3-debian13:nonroot
WORKDIR /app
ENV PYTHONPATH=/deps \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
COPY --from=build /deps /deps
COPY --from=build /app /app
USER nonroot
EXPOSE 8000
# ENTRYPOINT de l'image : ["/usr/bin/python3.13"]
CMD ["-m", "gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2"]
# Image construite par la CI (.github/workflows/ci.yaml), taguée avec le sha court du commit
