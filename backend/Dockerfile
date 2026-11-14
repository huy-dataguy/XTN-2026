FROM node:24-alpine
ARG RELEASE_TAG=local
LABEL org.opencontainers.image.version=$RELEASE_TAG
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY backend/src ./src
COPY backend/server.js ./
COPY backend/scripts ./scripts
USER node
EXPOSE 5000
CMD ["node", "server.js"]
