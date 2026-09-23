#!/bin/sh
# Punto de entrada del contenedor web. Espera a que Postgres esté aceptando
# conexiones, aplica migraciones, recolecta estáticos y arranca Gunicorn.
set -e

echo "[entrypoint] Esperando a PostgreSQL en ${DB_HOST}:${DB_PORT}..."
until python - <<'PYEOF'
import os
import socket
import sys

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.settimeout(2)
try:
    s.connect((os.environ["DB_HOST"], int(os.environ["DB_PORT"])))
except OSError:
    sys.exit(1)
finally:
    s.close()
PYEOF
do
  sleep 1
done
echo "[entrypoint] PostgreSQL disponible."

python manage.py migrate --noinput
python manage.py collectstatic --noinput

echo "[entrypoint] Arrancando Gunicorn..."
exec gunicorn api_pillbox.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers "${GUNICORN_WORKERS:-3}" \
  --timeout 60 \
  --access-logfile - \
  --error-logfile -
