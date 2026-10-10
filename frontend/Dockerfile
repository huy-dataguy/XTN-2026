FROM node:24-alpine AS build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
FROM caddy:2-alpine
ARG RELEASE_TAG=local
LABEL org.opencontainers.image.version=$RELEASE_TAG
COPY --from=build /app/frontend/dist /srv
COPY infra/production/Caddyfile /etc/caddy/Caddyfile
