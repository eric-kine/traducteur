# Image de production Top S'ASSUR (serveur Flask servi par gunicorn)
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080 \
    DB_PATH=/data/topsassur.db

WORKDIR /app

# Dépendances (couche mise en cache tant que requirements.txt ne change pas)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Code de l'application
COPY . .

# Volume pour la base de données (persistance des données)
RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 8080

# gunicorn : 3 workers, écoute sur le port fourni par l'hébergeur ($PORT)
CMD ["sh", "-c", "gunicorn -w 3 -b 0.0.0.0:${PORT} server:app"]
