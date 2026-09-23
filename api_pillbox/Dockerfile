# Imagen del backend Django (api_pillbox) para producción.
# Se construye desde la carpeta api_pillbox/ (build context = ./api_pillbox en docker-compose.yml).

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# libpq-dev + build-essential: necesarios para compilar psycopg2 (no psycopg2-binary).
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x entrypoint.sh \
    && mkdir -p /app/staticfiles

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
