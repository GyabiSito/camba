# syntax=docker/dockerfile:1@sha256:4edf897a3ffa55b89f906fc8cc78afdb3f1834cc9c7083565e611a8a7d5fe99e
ARG NODE_IMAGE=node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.28-alpine@sha256:7377697a821c131a924a7105fafbe7414db4e9fcc77a6f08f776f33f141ec3f8

FROM ${NODE_IMAGE} AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts --no-audit --no-fund
COPY angular.json tsconfig.json ./
COPY projects ./projects

FROM build AS build-store
RUN npm exec -- ng build store

FROM build AS build-admin
RUN npm exec -- ng build admin

FROM ${NODE_IMAGE} AS store
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4000
COPY --from=build-store --chown=node:node /src/dist/store/ ./
USER node
EXPOSE 4000
CMD ["node", "server/server.mjs"]

FROM ${NGINX_IMAGE} AS admin
COPY nginx-admin.conf /etc/nginx/conf.d/default.conf
COPY --from=build-admin /src/dist/admin/browser/ /usr/share/nginx/html/
EXPOSE 8080
