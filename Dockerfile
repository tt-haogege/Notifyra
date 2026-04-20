FROM node:22-bookworm-slim AS frontend-builder
WORKDIR /app

COPY frontend ./frontend
WORKDIR /app/frontend
RUN npm ci && npm run build

FROM node:22-bookworm-slim AS backend-builder
WORKDIR /app

COPY backend ./backend
WORKDIR /app/backend
RUN npm ci && npx prisma generate && npm run build

FROM node:22-bookworm-slim AS backend-prod-deps
WORKDIR /app

COPY backend ./backend
WORKDIR /app/backend
RUN npm ci --omit=dev && npm install --no-save prisma@7.6.0

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=file:/app/data/app.db

RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default /etc/nginx/conf.d/default.conf

COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist
COPY --from=backend-builder /app/backend/dist /app/backend/dist
COPY --from=backend-builder /app/backend/prisma /app/backend/prisma
COPY --from=backend-prod-deps /app/backend/node_modules /app/backend/node_modules
COPY --from=backend-builder /app/backend/node_modules/.prisma /app/backend/node_modules/.prisma
COPY --from=backend-builder /app/backend/node_modules/@prisma /app/backend/node_modules/@prisma

RUN cat <<'EOF' > /etc/nginx/conf.d/default.conf
server {
    listen 7718;
    server_name _;

    root /app/frontend/dist;
    index index.html;

    location = /api {
        return 301 /api/;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

RUN cat <<'EOF' > /usr/local/bin/start-notify.sh
#!/bin/sh
set -eu

mkdir -p /app/data
cd /app/backend

cleanup() {
  if [ -n "${backend_pid:-}" ] && kill -0 "$backend_pid" 2>/dev/null; then
    kill "$backend_pid"
    wait "$backend_pid" || true
  fi

  if [ -n "${nginx_pid:-}" ] && kill -0 "$nginx_pid" 2>/dev/null; then
    kill "$nginx_pid"
    wait "$nginx_pid" || true
  fi
}

trap cleanup INT TERM EXIT

npx prisma migrate deploy

node dist/main &
backend_pid=$!

if ! kill -0 "$backend_pid" 2>/dev/null; then
  wait "$backend_pid"
  exit 1
fi

nginx -g 'daemon off;' &
nginx_pid=$!

while kill -0 "$backend_pid" 2>/dev/null && kill -0 "$nginx_pid" 2>/dev/null; do
  sleep 1
done

backend_status=0
nginx_status=0

if wait "$backend_pid"; then
  backend_status=0
else
  backend_status=$?
fi

if wait "$nginx_pid"; then
  nginx_status=0
else
  nginx_status=$?
fi

if [ "$backend_status" -ne 0 ]; then
  exit "$backend_status"
fi

exit "$nginx_status"
EOF

RUN chmod +x /usr/local/bin/start-notify.sh

EXPOSE 7718
VOLUME ["/app/data"]

CMD ["/usr/local/bin/start-notify.sh"]
