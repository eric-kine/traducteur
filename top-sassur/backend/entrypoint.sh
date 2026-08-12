#!/bin/sh
# Point d'entrée du conteneur backend : attend la base, migre, sème, démarre.
set -e

echo "Attente de PostgreSQL (${POSTGRES_HOST:-db}:${POSTGRES_PORT:-5432})..."
until python -c "import socket,os,sys; s=socket.socket(); \
  s.settimeout(2); \
  s.connect((os.environ.get('POSTGRES_HOST','db'), int(os.environ.get('POSTGRES_PORT','5432')))); \
  s.close()" 2>/dev/null; do
  sleep 1
done

python manage.py migrate --noinput
python manage.py seed

if [ "${DJANGO_DEBUG:-True}" = "True" ]; then
  exec python manage.py runserver 0.0.0.0:8000
else
  python manage.py collectstatic --noinput
  exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3
fi
